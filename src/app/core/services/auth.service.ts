import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AdminAuthorizedArea, findAuthorizedAdminAreaByUrl, getDefaultAuthorizedAdminArea } from '../authorization/admin-authorized-area';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { ADMIN_PERMISSIONS, AdminPermission } from '../constants/admin-permissions.constants';
import {
  AdminUserRole,
  AuthStatus,
  BackendAuthenticatedUser,
  BackendLoginResponse,
  BackendStaffSignInResponse,
  AuthenticatedUser,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  PendingLegalDocument,
  PublicAuthOptions,
  ResetPasswordRequest,
  StaffCompanies,
  StaffSignInResult
} from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { resolveApiAssetUrl } from '../utils/api-asset-url.util';
import { BROWSER_LOCK } from '../utils/browser-lock.util';
import { ADMIN_RETURN_AREAS, safeReturnUrl } from '../utils/return-url.util';
import { AuthStorageService, StoredAuthSession } from './auth-storage.service';

const AUTH_DEBUG_ENABLED = !environment.production;
/** Cabecalho do token de selecao (S6): nunca no Authorization, e so as rotas da escolha de empresa o leem. */
const SELECTION_TOKEN_HEADER = 'X-Company-Selection';
const STAFF_REFRESH_LOCK = 'hl-gestao-staff-refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = `${PUBLIC_API_CONFIG.apiBaseUrl}/api/auth`;
  private readonly accessTokenValue = signal<string | null>(null);
  private readonly currentUserValue = signal<AuthenticatedUser | null>(null);
  private readonly statusValue = signal<AuthStatus>('initializing');
  private initializeSessionRequest$: Observable<boolean> | null = null;
  private authOptions$: Observable<PublicAuthOptions> | null = null;
  private readonly browserLock = inject(BROWSER_LOCK);

  readonly accessToken = this.accessTokenValue.asReadonly();
  readonly currentUser = this.currentUserValue.asReadonly();
  readonly status = this.statusValue.asReadonly();
  readonly isAuthenticated = computed(() => this.statusValue() === 'authenticated');
  readonly currentRole = computed<AdminUserRole | null>(() => this.resolveCurrentAdminRole());
  readonly currentPermissions = computed<string[]>(() => this.currentUserValue()?.permissions ?? []);
  readonly isAdmin = computed(() => this.currentUserValue()?.role === 'admin');
  readonly isOwner = computed(() => this.currentRole() === AdminUserRole.Owner || this.currentRole() === AdminUserRole.Admin);

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authStorageService: AuthStorageService
  ) {}

  /**
   * Login da equipe so com e-mail e senha (D3). Com uma empresa e nada a aceitar, a sessao ja vem; senao vem o token de
   * selecao (5 minutos, uso unico, so em memoria) para aceitar os documentos e escolher a empresa. A sessao da equipe e
   * uma so; a do cliente final fica no CustomerSessionService, por empresa.
   */
  login(request: LoginRequest): Observable<StaffSignInResult> {
    return this.httpClient.post<BackendStaffSignInResponse>(`${this.apiBaseUrl}/login`, request, { withCredentials: true }).pipe(
      map((response) => this.toSignInResult(response))
    );
  }

  /** Aceite dos Termos e da Privacidade com o token de selecao; devolve o que ainda falta aceitar. */
  acceptLegalDocuments(selectionToken: string, documents: readonly PendingLegalDocument[]): Observable<PendingLegalDocument[]> {
    const body = { documents: documents.map(({ id, version }) => ({ id, version })) };
    return this.httpClient.post<PendingLegalDocument[]>(`${this.apiBaseUrl}/legal-acceptances`, body, { headers: selectionHeaders(selectionToken), withCredentials: true });
  }

  /**
   * Entra na empresa escolhida. Com o token de selecao: fim do login. Sem ele: troca de empresa com a sessao atual
   * (abre a da nova empresa e encerra so a deste aparelho).
   */
  selectCompany(companyId: string, selectionToken?: string): Observable<LoginResponse> {
    const headers = selectionToken ? selectionHeaders(selectionToken) : undefined;
    return this.httpClient.post<BackendStaffSignInResponse>(`${this.apiBaseUrl}/select-company`, { companyId }, { headers, withCredentials: true }).pipe(
      map((response) => this.toSignInResult(response)),
      map((result) => {
        if (result.status !== 'authenticated') {
          throw new Error('A escolha de empresa nao abriu a sessao.');
        }

        return result.response;
      })
    );
  }

  /** Empresas da conta logada, para a troca de empresa. */
  listCompanies(): Observable<StaffCompanies> {
    return this.httpClient.get<StaffCompanies>(`${this.apiBaseUrl}/companies`, { withCredentials: true });
  }

  /** Revoga a sessao da equipe no backend e limpa o estado local. */
  logout(): Observable<void> {
    return this.httpClient.post<void>(`${this.apiBaseUrl}/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => of(undefined)),
      tap(() => this.clearSession('logout'))
    );
  }

  /**
   * Renova o access token da equipe pelo refresh token em cookie HttpOnly. Uma aba por vez (Web Locks): se outra aba
   * acabou de renovar, usa o token que ela guardou em vez de apresentar o mesmo refresh token de novo, que o servidor
   * trataria como reutilizacao e derrubaria a sessao.
   */
  refresh(): Observable<LoginResponse> {
    const tokenThatFailed = this.accessTokenValue();
    return this.browserLock(STAFF_REFRESH_LOCK, () => defer(() => this.refreshUnlessAnotherTabDid(tokenThatFailed)));
  }

  /** Carrega o usuario atual usando o access token ativo. */
  loadCurrentUser(): Observable<AuthenticatedUser> {
    const storedSession = this.authStorageService.getSession();

    return this.httpClient.get<BackendAuthenticatedUser>(`${this.apiBaseUrl}/me`, { withCredentials: true }).pipe(
      map((user) => this.mapBackendUser(user)),
      tap((user) => {
        this.currentUserValue.set(user);
        this.statusValue.set('authenticated');
        this.saveCurrentUserFromBackend(user, storedSession);
      })
    );
  }

  /** Restaura sessao ao abrir a aplicacao e atualiza dados administrativos pelo backend. */
  initializeSession(): Observable<boolean> {
    if (this.statusValue() !== 'initializing') {
      return of(this.isAuthenticated());
    }

    const storedSession = this.authStorageService.getSession();

    // Sessao unica antiga de cliente (sem empresa): agora cliente tem sessao por empresa. Descarta e pede login de novo.
    if (storedSession?.user.role === 'client') {
      this.clearSession('legacy-customer-session');
      return of(false);
    }

    if (storedSession) {
      this.restoreAccessTokenForCurrentUserRequest(storedSession);
      this.initializeSessionRequest$ ??= this.loadCurrentUser().pipe(
        map(() => true),
        catchError(() => {
          this.clearSession('load-current-user-failed');
          return of(false);
        }),
        finalize(() => {
          this.initializeSessionRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

      return this.initializeSessionRequest$;
    }

    // Visitante que nunca logou neste navegador nao tem cookie de refresh: chamar a rota so
    // produziria um 401 no console de quem esta apenas navegando pelo site publico.
    if (!this.authStorageService.hasRefreshableSession()) {
      return of(false);
    }

    this.initializeSessionRequest$ ??= this.refresh().pipe(
      map(() => true),
      catchError(() => {
        this.clearSession('initialize-session-failed');
        return of(false);
      }),
      finalize(() => {
        this.initializeSessionRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.initializeSessionRequest$;
  }

  /** Recuperacao de senha da conta da equipe (vale em todas as empresas), so com o e-mail; resposta sempre generica. */
  requestStaffPasswordReset(email: string): Observable<ForgotPasswordResponse> {
    return this.httpClient.post<ForgotPasswordResponse>(`${this.apiBaseUrl}/forgot-password`, { email }, { withCredentials: true });
  }

  /** Redefine senha do painel usando token recebido por e-mail. */
  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.httpClient.post<void>(`${this.apiBaseUrl}/reset-password`, request, { withCredentials: true });
  }

  /** Opcoes publicas de login (Client ID do Google), buscadas uma vez por carregamento do site. */
  getAuthOptions(): Observable<PublicAuthOptions> {
    this.authOptions$ ??= this.httpClient.get<PublicAuthOptions>(`${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/auth-options`).pipe(
      catchError(() => {
        this.authOptions$ = null;
        return of({ googleClientId: null, publicSiteUrl: '' });
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.authOptions$;
  }

  /** Limpa access token e usuario quando a sessao termina. */
  clearSession(reason = 'manual'): void {
    this.log('clear-session', { reason });
    this.accessTokenValue.set(null);
    this.currentUserValue.set(null);
    this.statusValue.set('unauthenticated');
    this.authStorageService.clearSession();
  }

  /** Retorna a URL inicial correta para o perfil autenticado. */
  getAuthenticatedHomeUrl(): string {
    return this.getDefaultAuthorizedRoute();
  }

  /** Retorna a primeira rota permitida para a sessao atual sem assumir dashboard fixo. */
  getDefaultAuthorizedRoute(): string {
    const adminArea = this.getDefaultAuthorizedAdminArea();
    return adminArea?.route ?? '/acesso-negado';
  }

  /** Retorna a primeira area administrativa permitida para a sessao atual. */
  getDefaultAuthorizedAdminArea(): AdminAuthorizedArea | null {
    return getDefaultAuthorizedAdminArea(this.currentRole(), this.currentPermissions());
  }

  /** Escolhe a URL pos-login somente depois de a sessao atual possuir role e permissoes. */
  getPostLoginRedirectUrl(returnUrl: string | null): string {
    if (!returnUrl) {
      return this.getDefaultAuthorizedRoute();
    }

    const adminReturnUrl = safeReturnUrl(returnUrl, ADMIN_RETURN_AREAS, { allowCompanySlugPrefix: false });
    if (this.isAdmin() && adminReturnUrl && findAuthorizedAdminAreaByUrl(adminReturnUrl, this.currentRole(), this.currentPermissions())) {
      return adminReturnUrl.replace(/^\/painel(?=\/|$)/, '/admin');
    }

    return this.getDefaultAuthorizedRoute();
  }

  /** Verifica permissao administrativa considerando acesso total implicito do proprietario/admin. */
  hasPermission(permission: AdminPermission | string): boolean {
    return this.isOwner() || this.currentPermissions().includes(permission);
  }

  /**
   * Juntar clientes: so o Dono tem pelo papel. O Administrador, que passa em hasPermission por ser "owner" para o
   * resto do painel, NAO a tem (a API responde 403 forbidden), entao aqui ela vem do papel Owner ou da lista.
   */
  canMergeCustomers(): boolean {
    return this.currentRole() === AdminUserRole.Owner || this.currentPermissions().includes(ADMIN_PERMISSIONS.customersMerge);
  }

  /** Verifica se o usuario possui ao menos uma das permissoes informadas. */
  hasAnyPermission(permissions: readonly (AdminPermission | string)[]): boolean {
    return this.isOwner() || permissions.some((permission) => this.hasPermission(permission));
  }

  /** Atualiza dados publicos do usuario autenticado e persiste a sessao atualizada. */
  updateAuthenticatedUser(user: AuthenticatedUser): void {
    const accessToken = this.accessTokenValue();

    if (!accessToken) {
      return;
    }

    const session = {
      user,
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()
    };

    this.applySession(session);
  }

  /**
   * Adota uma sessao de tenant emitida pela plataforma para suporte. A sessao e curta e nao tem refresh:
   * quando o token expira, o operador precisa autorizar o acesso de novo na plataforma.
   */
  applyImpersonatedSession(response: LoginResponse): void {
    this.applySession(response);
  }

  private applySession(response: LoginResponse): void {
    this.log('session-authenticated');
    this.accessTokenValue.set(response.accessToken);
    this.currentUserValue.set(response.user);
    this.statusValue.set('authenticated');
    this.authStorageService.saveSession(response);
  }

  private applyStoredSession(session: StoredAuthSession): void {
    this.log('session-restored');
    this.accessTokenValue.set(session.accessToken);
    this.currentUserValue.set(session.user);
    this.statusValue.set('authenticated');
  }

  /** Persiste o usuario retornado por /me mantendo o access token vigente. */
  private saveCurrentUserFromBackend(user: AuthenticatedUser, storedSession: StoredAuthSession | null): void {
    const accessToken = this.accessTokenValue();

    if (!accessToken) {
      return;
    }

    this.authStorageService.saveSession({
      user,
      accessToken,
      accessTokenExpiresAt: storedSession?.accessTokenExpiresAt ?? new Date(Date.now() + 1000 * 60 * 15).toISOString()
    });
  }

  /** Restaura somente o token para permitir /me sem confiar em usuario/permissoes salvos. */
  private restoreAccessTokenForCurrentUserRequest(session: StoredAuthSession): void {
    this.log('access-token-restored-for-current-user-request');
    this.accessTokenValue.set(session.accessToken);
    this.currentUserValue.set(null);
    this.statusValue.set('initializing');
  }

  private refreshUnlessAnotherTabDid(tokenThatFailed: string | null): Observable<LoginResponse> {
    const stored = this.authStorageService.getSession();
    if (stored && stored.accessToken !== tokenThatFailed && Date.parse(stored.accessTokenExpiresAt) - Date.now() > 30_000) {
      this.log('session-adopted-from-other-tab');
      this.applyStoredSession(stored);
      return of(stored);
    }

    return this.httpClient.post<BackendLoginResponse>(`${this.apiBaseUrl}/refresh`, {}, { withCredentials: true }).pipe(
      map((response) => this.mapBackendLoginResponse(response)),
      tap((response) => this.applySession(response))
    );
  }

  private toSignInResult(response: BackendStaffSignInResponse): StaffSignInResult {
    if (response.status === 'selection-required' && response.selection) {
      return { status: 'selection-required', selection: response.selection };
    }

    const session = this.mapBackendLoginResponse({
      user: response.user as BackendAuthenticatedUser,
      accessToken: response.accessToken ?? '',
      accessTokenExpiresAt: response.accessTokenExpiresAt ?? ''
    });
    this.authStorageService.forgetOnboardingPostponed();
    this.applySession(session);
    return { status: 'authenticated', response: session };
  }

  private mapBackendLoginResponse(response: BackendLoginResponse): LoginResponse {
    return {
      ...response,
      user: this.mapBackendUser(response.user)
    };
  }

  private mapBackendUser(user: BackendAuthenticatedUser): AuthenticatedUser {
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: 'admin',
      adminRole: user.role
    };

    if (user.professionalId !== undefined) {
      authenticatedUser.professionalId = user.professionalId;
    }

    if (user.permissions !== undefined) {
      authenticatedUser.permissions = user.permissions;
    }

    if (user.avatarUrl !== undefined && user.avatarUrl !== null) {
      authenticatedUser.avatarUrl = resolveApiAssetUrl(user.avatarUrl) ?? undefined;
    }

    if (user.emailVerified !== undefined) {
      authenticatedUser.emailVerified = user.emailVerified;
    }

    if (user.companyCount !== undefined) {
      authenticatedUser.companyCount = user.companyCount;
    }

    return authenticatedUser;
  }

  /** Mantem compatibilidade com sessoes admin salvas antes de existir adminRole no storage. */
  private resolveCurrentAdminRole(): AdminUserRole | null {
    const currentUser = this.currentUserValue();

    if (!currentUser || currentUser.role !== 'admin') {
      return null;
    }

    return currentUser.adminRole ?? AdminUserRole.Admin;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (!AUTH_DEBUG_ENABLED) {
      return;
    }

    console.debug('[auth-service]', message, data ?? {});
  }

}

function selectionHeaders(selectionToken: string): HttpHeaders {
  return new HttpHeaders({ [SELECTION_TOKEN_HEADER]: selectionToken });
}
