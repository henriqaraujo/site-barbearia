import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CustomerSessionService } from '../services/customer-session.service';
import { environment } from '../../../environments/environment';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { isPlatformApiUrl } from '../utils/platform-api.util';

/** Renovacoes em andamento por sessao: 'staff' para a equipe, 'customer' para a conta do cliente. */
const refreshRequests = new Map<string, Observable<unknown>>();
let redirectingToLogin = false;
const AUTH_DEBUG_ENABLED = !environment.production;
const STAFF_SESSION_KEY = 'staff';
const CUSTOMER_SESSION_KEY = 'customer';
const COMPANY_API_PATTERN = /\/api\/public\/companies\/([^/?#]+)(?:[/?#]|$)/;
const CUSTOMER_ACCOUNT_API_PATTERN = /\/api\/customer-account(?:[/?#]|$)/;
/** Rotas antigas de login do cliente por empresa (Fase 3): respondem 410 com este codigo, "ir para o login novo". */
const CUSTOMER_LOGIN_MOVED_CODE = 'customer-login-moved';

/**
 * Anexa o token certo pela URL e renova uma vez em 401. Chamada da API de uma empresa (/api/public/companies/{slug}/...)
 * e da conta do cliente (/api/customer-account/...) leva o token da conta do cliente, se houver: a API resolve o
 * vinculo da conta com a empresa da rota (D4). As demais levam o da equipe, que nunca vai para o site publico.
 */
export const authInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  // Token e refresh so valem para a API do proprio sistema: qualquer chamada externa (ex.: consulta de CEP)
  // receberia o Bearer do usuario se o interceptor anexasse o cabecalho a toda URL.
  if (isPlatformApiUrl(request.url) || !isOwnApiUrl(request.url)) {
    return next(request);
  }

  const companySlug = companySlugOf(request.url);
  return companySlug !== null || CUSTOMER_ACCOUNT_API_PATTERN.test(request.url)
    ? handleCustomerRequest(request, next, companySlug)
    : handleStaffRequest(request, next);
};

function handleStaffRequest(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const authService = inject(AuthService);
  const router = inject(Router);

  log('intercept-url', { url: request.url });

  return next(addAuthorizationHeader(request, authService.accessToken())).pipe(
    catchError((error: unknown) => {
      log('http-error', { url: request.url, status: error instanceof HttpErrorResponse ? error.status : 'unknown' });

      if (!shouldRefresh(request, error)) {
        if (isStaffRefreshEndpoint(request.url) && error instanceof HttpErrorResponse && error.status === 401) {
          log('refresh-401-final');
          authService.clearSession('refresh-endpoint-401');
        }

        return throwError(() => error);
      }

      return sharedRefresh(STAFF_SESSION_KEY, () => authService.refresh()).pipe(
        switchMap(() => next(addAuthorizationHeader(request, authService.accessToken()))),
        catchError((refreshError: unknown) => {
          log('refresh-final-failure', { status: refreshError instanceof HttpErrorResponse ? refreshError.status : 'unknown' });
          authService.clearSession('refresh-failed');
          redirectToLoginOnce(router, '/login');
          return throwError(() => refreshError);
        })
      );
    })
  );
}

function handleCustomerRequest(request: HttpRequest<unknown>, next: HttpHandlerFn, companySlug: string | null): Observable<HttpEvent<unknown>> {
  const customerSessions = inject(CustomerSessionService);
  const router = inject(Router);

  return next(addAuthorizationHeader(request, customerSessions.accessToken())).pipe(
    catchError((error: unknown) => {
      // Um lugar so para "o login mudou": quem chamar uma rota antiga vai para o login novo da empresa.
      if (companySlug && isCustomerLoginMoved(error)) {
        redirectToLoginOnce(router, `/${companySlug}/login`);
        return throwError(() => error);
      }

      // Sem conta logada nao ha o que renovar: o 401 e a resposta de verdade.
      if (!shouldRefresh(request, error) || !customerSessions.hasSession()) {
        return throwError(() => error);
      }

      return sharedRefresh(CUSTOMER_SESSION_KEY, () => customerSessions.refresh()).pipe(
        switchMap(() => next(addAuthorizationHeader(request, customerSessions.accessToken()))),
        catchError((refreshError: unknown) => {
          customerSessions.clear();
          // So tira da tela quem estava na area do cliente ou na /minha-conta; no site publico a pessoa segue como anonima.
          if (companySlug && router.url.startsWith(`/${companySlug}/cliente`)) {
            redirectToLoginOnce(router, `/${companySlug}/login`);
          } else if (router.url.startsWith('/minha-conta')) {
            redirectToLoginOnce(router, '/entrar');
          }

          return throwError(() => refreshError);
        })
      );
    })
  );
}

/** Uma renovacao por sessao por vez: as demais requisicoes com 401 aguardam a mesma. */
function sharedRefresh(key: string, refresh: () => Observable<unknown>): Observable<unknown> {
  let request$ = refreshRequests.get(key);
  if (!request$) {
    request$ = refresh().pipe(
      tap(() => log('refresh-success', { key })),
      shareReplay(1),
      finalize(() => refreshRequests.delete(key))
    );
    refreshRequests.set(key, request$);
  }

  return request$;
}

function companySlugOf(url: string): string | null {
  const match = COMPANY_API_PATTERN.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function isOwnApiUrl(url: string): boolean {
  return url.startsWith('/api/') || (!!PUBLIC_API_CONFIG.apiBaseUrl && url.startsWith(`${PUBLIC_API_CONFIG.apiBaseUrl}/api/`));
}

function addAuthorizationHeader(request: HttpRequest<unknown>, accessToken: string | null): HttpRequest<unknown> {
  if (!accessToken || isAuthEndpoint(request.url)) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

function shouldRefresh(request: HttpRequest<unknown>, error: unknown): boolean {
  // Com o token de selecao ainda nao ha sessao: o 401 (token vencido ou usado) e a resposta de verdade.
  return error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint(request.url) && !request.headers.has('X-Company-Selection');
}

/**
 * Rotas de autenticacao que nao levam o token da equipe nem disparam renovacao: login, escolha de empresa com o token
 * de selecao (vai no proprio cabecalho), links de e-mail e logout. A lista e a troca de empresa ja logado levam o token.
 */
function isAuthEndpoint(url: string): boolean {
  return /\/api\/auth\/(login|refresh|logout|forgot-password|reset-password|legal-acceptances|verify-email|invitations\/preview|invitations\/accept)(\?|$)/.test(url) ||
    /\/api\/public\/companies\/[^/]+\/customers\/(login|register|refresh|logout|google|forgot-password|reset-password)(\?|$)/.test(url) ||
    /\/api\/customer-account\/(login|register|google|verify-email|forgot-password|reset-password|session\/refresh|session\/logout)(\?|$)/.test(url);
}

function isCustomerLoginMoved(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 410 && error.error?.code === CUSTOMER_LOGIN_MOVED_CODE;
}

function isStaffRefreshEndpoint(url: string): boolean {
  return /\/api\/auth\/refresh(\?|$)/.test(url);
}

function redirectToLoginOnce(router: Router, loginUrl: string): void {
  if (redirectingToLogin || router.url.startsWith(loginUrl)) {
    return;
  }

  redirectingToLogin = true;
  log('redirect-login', { from: router.url, to: loginUrl });
  void router.navigateByUrl(loginUrl).finally(() => {
    redirectingToLogin = false;
  });
}

function log(message: string, data?: Record<string, unknown>): void {
  if (!AUTH_DEBUG_ENABLED) {
    return;
  }

  console.debug('[auth-interceptor]', message, data ?? {});
}
