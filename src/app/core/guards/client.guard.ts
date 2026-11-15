import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { CustomerSessionService } from '../services/customer-session.service';
import { routeCompanySlug } from '../tenancy/route-company-slug';

/**
 * Contratar plano: basta a conta logada; sem vinculo na empresa, a contratacao cria o vinculo (item 7). Sem conta, vai
 * para o login desta empresa e volta para a contratacao.
 */
export const customerAccountGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const router = inject(Router);
  const companySlug = routeCompanySlug(route);
  if (!companySlug) {
    return router.createUrlTree(['/']);
  }

  return inject(CustomerSessionService).hasSession()
    || router.createUrlTree([`/${companySlug}/login`], { queryParams: { returnUrl: state.url } });
};

/** /minha-conta (Fase 4): so a conta logada; sem conta, vai para o /entrar e volta para onde estava. */
export const myAccountGuard: CanActivateFn = (_route, state): boolean | UrlTree =>
  inject(CustomerSessionService).hasSession()
  || inject(Router).createUrlTree(['/entrar'], { queryParams: { returnUrl: state.url } });

/**
 * Area do cliente de uma empresa: abre sempre para a conta logada. O guard so confere o vinculo com a empresa (o layout
 * mostra o estado vazio sem ele); abrir a area nao cria vinculo. Sem conta, vai para o login e volta para onde estava.
 * Antes (Fase 3, ate 06/10) a conta sem vinculo era mandada para o agendamento: quem ja estava no agendamento clicava
 * em "Area do Cliente" e nada acontecia.
 */
export const clientGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const customerSessions = inject(CustomerSessionService);
  const router = inject(Router);
  const companySlug = routeCompanySlug(route);
  if (!companySlug) {
    return of(router.createUrlTree(['/']));
  }

  return customerSessions.ensureSession(companySlug).pipe(
    map(() => customerSessions.hasSession()
      || router.createUrlTree([`/${companySlug}/login`], { queryParams: { returnUrl: state.url } }))
  );
};
