import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { CustomerSessionService } from '../services/customer-session.service';
import { isCompanySlugSegment } from '../tenancy/company-slug-rules';
import { readLinkParams } from '../utils/link-token.util';

/**
 * Rotas de cliente de antes da Fase 2, sem empresa na URL (/cliente/**, /cadastro, /agendamento,
 * /assinatura/contratar/:id): com a conta logada, vao para a mesma rota na ultima empresa em que ela usou a area do
 * cliente; sem conta, para a raiz.
 */
export const legacyCustomerRouteRedirect: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const companySlug = inject(CustomerSessionService).latestSessionSlug() ?? '';
  const target = isCompanySlugSegment(companySlug) ? `/${companySlug}${state.url}` : '/';

  return new RedirectCommand(router.parseUrl(target), { replaceUrl: true });
};

/**
 * /redefinir-senha e da equipe. Links de cliente enviados antes da Fase 2 (conta=cliente&empresa=x, no fragmento
 * ou ainda na query) vao para /x/redefinir-senha, levando so o token e sempre no fragmento.
 */
export const legacyCustomerResetRedirect: CanActivateFn = (route) => {
  const params = readLinkParams(route);
  const companySlug = params.get('empresa') ?? '';
  const token = params.get('token');

  if (params.get('conta') !== 'cliente' || !isCompanySlugSegment(companySlug)) {
    return true;
  }

  return redirectWithToken(inject(Router), `/${companySlug}/redefinir-senha`, token);
};

/** Link antigo de sair da fila (/fila/cancelar#token=...&empresa=x) vai para /x/fila/cancelar#token=... */
export const legacyWaitlistCancelRedirect: CanActivateFn = (route) => {
  const params = readLinkParams(route);
  const companySlug = params.get('empresa') ?? '';

  return isCompanySlugSegment(companySlug)
    ? redirectWithToken(inject(Router), `/${companySlug}/fila/cancelar`, params.get('token'))
    : true;
};

/** O fragmento da UrlTree fica decodificado, como o Router o entrega a rota de destino (ver readLinkParams). */
function redirectWithToken(router: Router, path: string, token: string | null): RedirectCommand {
  const target = router.parseUrl(path);
  target.fragment = token ? `token=${token}` : null;
  return new RedirectCommand(target, { replaceUrl: true });
}
