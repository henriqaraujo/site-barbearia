import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import {
  AuthenticatedUser,
  BackendAuthenticatedCustomer,
  BackendCustomerSignInResponse,
  CustomerAccountLoginRequest,
  CustomerAccountProfile,
  CustomerAccountRefreshResponse,
  CustomerAccountRegisterRequest,
  CustomerEmailVerified,
  CustomerSignInResult,
  ForgotPasswordResponse,
  GoogleLoginRequest,
  ResetPasswordRequest
} from '../models/auth.model';
import { TenantContextStore } from '../tenancy/tenant-context.store';
import { BROWSER_LOCK } from '../utils/browser-lock.util';
import { AuthStorageService, StoredAuthSession, StoredCustomerAccountSession } from './auth-storage.service';

const CUSTOMER_REFRESH_LOCK = 'hl-gestao-customer-refresh';

/** Rotas da conta global do cliente (Fase 3). O cookie de refresh vive em /api/customer-account/session. */
export function customerAccountApiUrl(): string {
  return `${PUBLIC_API_CONFIG.apiBaseUrl}/api/customer-account`;
}

/** Rotas do cliente numa empresa; com o token da conta, a API resolve o vinculo da conta com a empresa da rota. */
export function companyCustomerApiUrl(companySlug: string): string {
  return `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/customers`;
}

/**
 * Sessao do cliente final (conta unica, Fase 3): uma conta, uma sessao, para todas as empresas. O vinculo com cada
 * empresa (o cliente daquela barbearia) e conferido na API por empresa e guardado so nesta carga da pagina:
 * - `isAccountAuthenticated`: ha conta logada neste navegador;
 * - `current`/`currentCustomer`/`isAuthenticated`: a conta tem vinculo com a empresa da URL (o que a area do cliente
 *   e a contratacao de plano exigem). Sem vinculo, agendar cria o vinculo na hora (item 7) no servidor.
 * A sessao da equipe e outra coisa e continua no AuthService.
 */
@Injectable({ providedIn: 'root' })
export class CustomerSessionService {
  private readonly httpClient = inject(HttpClient);
  private readonly authStorageService = inject(AuthStorageService);
  private readonly tenantContextStore = inject(TenantContextStore);
  private readonly browserLock = inject(BROWSER_LOCK);
  private readonly sessionValue = signal<StoredCustomerAccountSession | null>(this.authStorageService.getCustomerAccountSession());
  /** Vinculo da conta por empresa nesta carga: o cliente daquela empresa, ou null (conferido: sem vinculo ativo). */
  private readonly membershipsValue = signal<Readonly<Record<string, AuthenticatedUser | null>>>({});
  private readonly validationRequests = new Map<string, Observable<boolean>>();

  readonly account = computed<CustomerAccountProfile | null>(() => this.sessionValue()?.account ?? null);
  readonly isAccountAuthenticated = computed(() => this.sessionValue() !== null);
  /** Sessao na empresa da URL: conta logada E vinculo conferido com esta empresa. */
  readonly current = computed<StoredAuthSession | null>(() => {
    const slug = this.tenantContextStore.slug();
    const session = this.sessionValue();
    const membership = slug ? this.membershipsValue()[slug] : undefined;
    return session && membership ? { user: membership, accessToken: session.accessToken, accessTokenExpiresAt: session.accessTokenExpiresAt } : null;
  });
  readonly currentCustomer = computed<AuthenticatedUser | null>(() => this.current()?.user ?? null);
  readonly isAuthenticated = computed(() => this.current() !== null);

  accessToken(): string | null {
    return this.sessionValue()?.accessToken ?? null;
  }

  hasSession(): boolean {
    return this.sessionValue() !== null;
  }

  /** Ultima empresa em que a conta usou a area do cliente: leva links antigos sem slug (/cliente, /agendamento). */
  latestSessionSlug(): string | null {
    return this.sessionValue()?.lastCompanySlug ?? null;
  }

  login(request: CustomerAccountLoginRequest): Observable<CustomerSignInResult> {
    return this.httpClient.post<BackendCustomerSignInResponse>(`${customerAccountApiUrl()}/login`, request, { withCredentials: true }).pipe(
      map((response) => this.applySignIn(response))
    );
  }

  loginWithGoogle(request: GoogleLoginRequest): Observable<CustomerSignInResult> {
    return this.httpClient.post<BackendCustomerSignInResponse>(`${customerAccountApiUrl()}/google`, request, { withCredentials: true }).pipe(
      map((response) => this.applySignIn(response))
    );
  }

  /** Cadastro global: a resposta e sempre a mesma (S3), exista ou nao a conta; nao abre sessao. */
  register(request: CustomerAccountRegisterRequest): Observable<ForgotPasswordResponse> {
    return this.httpClient.post<ForgotPasswordResponse>(`${customerAccountApiUrl()}/register`, request);
  }

  /**
   * Renova a sessao pelo cookie, uma aba por vez (Web Locks): duas abas apresentando o mesmo refresh token fariam o
   * servidor derrubar a sessao inteira. A aba que chega depois usa o token que a outra acabou de guardar.
   */
  refresh(): Observable<void> {
    const tokenThatFailed = this.accessToken();
    return this.browserLock(CUSTOMER_REFRESH_LOCK, () => defer(() => this.refreshUnlessAnotherTabDid(tokenThatFailed)));
  }

  /** Sai so deste aparelho; os outros seguem logados. */
  logout(): Observable<void> {
    return this.httpClient.post<void>(`${customerAccountApiUrl()}/session/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => of(undefined)),
      tap(() => this.clear())
    );
  }

  /** Esqueci a senha da conta: so o e-mail, resposta sempre generica. */
  requestPasswordReset(email: string): Observable<ForgotPasswordResponse> {
    return this.httpClient.post<ForgotPasswordResponse>(`${customerAccountApiUrl()}/forgot-password`, { email });
  }

  /** Redefine a senha da conta pelo token do link (vale em todas as empresas). */
  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.httpClient.post<void>(`${customerAccountApiUrl()}/reset-password`, request);
  }

  verifyEmail(token: string): Observable<CustomerEmailVerified> {
    return this.httpClient.post<CustomerEmailVerified>(`${customerAccountApiUrl()}/verify-email`, { token }).pipe(
      tap(() => this.markEmailVerified())
    );
  }

  /** Reenvia o link de confirmacao para a conta logada (cota silenciosa no servidor). */
  resendVerification(): Observable<void> {
    return this.httpClient.post<void>(`${customerAccountApiUrl()}/resend-verification`, {});
  }

  /** Rele os dados da conta: o servidor guarda o celular informado quando cria um vinculo para a conta sem celular (item 7). */
  reloadAccount(): Observable<void> {
    return this.httpClient.get<CustomerAccountProfile>(`${customerAccountApiUrl()}/me`).pipe(
      tap((account) => {
        const session = this.sessionValue();
        if (session) {
          this.saveSession({ ...session, account });
        }
      }),
      map(() => undefined)
    );
  }

  /**
   * Confere, uma vez por carga da pagina, o vinculo da conta com a empresa (o interceptor renova o token se precisar).
   * Sem conta logada, ou sem vinculo ativo nesta empresa, responde false; a sessao da conta so cai se a API recusar a
   * conta (401 depois da renovacao).
   */
  ensureSession(companySlug: string): Observable<boolean> {
    if (!this.hasSession()) {
      return of(false);
    }

    const known = this.membershipsValue()[companySlug];
    if (known !== undefined) {
      return of(known !== null);
    }

    const pending = this.validationRequests.get(companySlug);
    if (pending) {
      return pending;
    }

    const validation$ = this.httpClient.get<BackendAuthenticatedCustomer>(`${companyCustomerApiUrl(companySlug)}/me`).pipe(
      map((customer) => {
        this.setMembership(companySlug, this.mapCustomer(customer));
        this.rememberCompany(companySlug);
        return true;
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clear();
        } else {
          this.setMembership(companySlug, null);
        }

        return of(false);
      }),
      finalize(() => this.validationRequests.delete(companySlug)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.validationRequests.set(companySlug, validation$);
    return validation$;
  }

  /** Dados da conta editados em /minha-conta: a sessao guardada passa a mostrar os novos. */
  applyAccount(account: CustomerAccountProfile): void {
    const session = this.sessionValue();
    if (session) {
      this.saveSession({ ...session, account });
    }
  }

  /** Troca de senha: o carimbo girou e a resposta traz o token novo desta sessao (as outras cairam). */
  applyRefreshedSession(response: CustomerAccountRefreshResponse): void {
    const session = this.sessionValue();
    if (session) {
      this.saveSession({ ...session, account: response.account, accessToken: response.accessToken, accessTokenExpiresAt: response.accessTokenExpiresAt });
    }
  }

  /** Esquece o vinculo conferido (ex.: agendou numa empresa nova: o servidor criou o vinculo e a tela confere de novo). */
  forgetMembership(companySlug: string): void {
    const { [companySlug]: _removed, ...remaining } = this.membershipsValue();
    this.membershipsValue.set(remaining);
  }

  /** Atualiza os dados do cliente da empresa (ex.: perfil editado) mantendo a sessao. */
  updateCustomer(companySlug: string, user: AuthenticatedUser): void {
    if (this.membershipsValue()[companySlug]) {
      this.setMembership(companySlug, user);
    }
  }

  clear(): void {
    this.validationRequests.clear();
    this.membershipsValue.set({});
    this.saveSession(null);
  }

  private refreshUnlessAnotherTabDid(tokenThatFailed: string | null): Observable<void> {
    const stored = this.authStorageService.getCustomerAccountSession();
    if (stored && stored.accessToken !== tokenThatFailed && Date.parse(stored.accessTokenExpiresAt) - Date.now() > 30_000) {
      this.sessionValue.set(stored);
      return of(undefined);
    }

    return this.httpClient.post<CustomerAccountRefreshResponse>(`${customerAccountApiUrl()}/session/refresh`, {}, { withCredentials: true }).pipe(
      tap((response) => this.saveSession({
        account: response.account,
        accessToken: response.accessToken,
        accessTokenExpiresAt: response.accessTokenExpiresAt,
        lastCompanySlug: this.sessionValue()?.lastCompanySlug ?? null
      })),
      map(() => undefined),
      catchError((error: unknown) => {
        this.clear();
        return throwError(() => error);
      })
    );
  }

  private applySignIn(response: BackendCustomerSignInResponse): CustomerSignInResult {
    if (response.status !== 'authenticated' || !response.account || !response.accessToken || !response.accessTokenExpiresAt) {
      return { status: 'legal-acceptance-required', documents: response.pendingLegalDocuments };
    }

    this.validationRequests.clear();
    this.membershipsValue.set({});
    this.saveSession({
      account: response.account,
      accessToken: response.accessToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      lastCompanySlug: this.sessionValue()?.lastCompanySlug ?? null
    });
    return { status: 'authenticated', account: response.account };
  }

  private markEmailVerified(): void {
    const session = this.sessionValue();
    if (session) {
      this.saveSession({ ...session, account: { ...session.account, emailVerified: true } });
    }

    // Vinculos ligados pela confirmacao aparecem na proxima conferencia.
    this.membershipsValue.set({});
  }

  private rememberCompany(companySlug: string): void {
    const session = this.sessionValue();
    if (session && session.lastCompanySlug !== companySlug) {
      this.saveSession({ ...session, lastCompanySlug: companySlug });
    }
  }

  private setMembership(companySlug: string, user: AuthenticatedUser | null): void {
    this.membershipsValue.set({ ...this.membershipsValue(), [companySlug]: user });
  }

  private saveSession(session: StoredCustomerAccountSession | null): void {
    this.sessionValue.set(session);
    this.authStorageService.saveCustomerAccountSession(session);
  }

  private mapCustomer(customer: BackendAuthenticatedCustomer): AuthenticatedUser {
    return {
      id: customer.id,
      companyId: customer.companyId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      role: 'client'
    };
  }
}
