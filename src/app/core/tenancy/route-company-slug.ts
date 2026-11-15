import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Slug do segmento /:companySlug da rota informada (ou de algum ancestral). Null nas rotas sem empresa, como o
 * /redefinir-senha da equipe: diferente do TenantContextStore, nao herda a empresa da navegacao anterior.
 */
export function routeCompanySlug(route: ActivatedRouteSnapshot): string | null {
  return route.pathFromRoot.map((snapshot) => snapshot.paramMap.get('companySlug')).find((slug) => !!slug) ?? null;
}
