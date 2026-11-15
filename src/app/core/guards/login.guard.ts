import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CustomerSessionService } from '../services/customer-session.service';
import { routeCompanySlug } from '../tenancy/route-company-slug';

/**
 * Quem ja tem sessao nao precisa da tela de entrar: no login da empresa (/{slug}/login), a conta do cliente logada vai
 * para a area do cliente daquela empresa (que leva ao agendamento se ainda nao ha vinculo); no login da equipe (/login),
 * a equipe logada vai para o painel.
 */
export const loginGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const companySlug = routeCompanySlug(route);

  if (companySlug) {
    return of(inject(CustomerSessionService).hasSession() ? router.createUrlTree([`/${companySlug}/cliente`]) : true);
  }

  // /entrar (conta do cliente pela raiz): a conta logada vai para a /minha-conta (Fase 4).
  if (route.data?.['customerAccount'] === true) {
    return of(inject(CustomerSessionService).hasSession() ? router.createUrlTree(['/minha-conta']) : true);
  }

  const authService = inject(AuthService);
  return authService.initializeSession().pipe(
    map((isAuthenticated) => isAuthenticated ? router.createUrlTree([authService.getAuthenticatedHomeUrl()]) : true)
  );
};
