import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router, UrlSegment } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { CompanyContextService } from '../services/company-context.service';
import { isCompanySlugSegment } from './company-slug-rules';
import { TenantContextStore } from './tenant-context.store';

/**
 * Resolve a empresa do segmento /:companySlug e preenche o TenantContextStore. Sempre deixa a rota abrir: o layout
 * publico mostra "Barbearia nao encontrada" ou "Agendamento temporariamente indisponivel" conforme o estado. Slug antigo leva ao
 * atual trocando so o primeiro segmento, sem nova entrada no historico e mantendo query e fragmento.
 */
export const tenantGuard: CanActivateFn = (route, state): Observable<boolean | RedirectCommand> | boolean =>
  resolveTenant(route.paramMap.get('companySlug') ?? '', state.url);

function resolveTenant(slug: string, url: string): Observable<boolean | RedirectCommand> | boolean {
  const store = inject(TenantContextStore);
  const companyContextService = inject(CompanyContextService);
  const router = inject(Router);

  if (!isCompanySlugSegment(slug)) {
    store.fail(slug, 'not-found');
    return true;
  }

  store.startLoading(slug);

  return companyContextService.loadPublicCompany(slug).pipe(
    map((company) => {
      if (company.canonicalSlug !== slug) {
        const canonicalUrl = router.parseUrl(url);
        const segments = canonicalUrl.root.children['primary']?.segments ?? [];
        segments[0] = new UrlSegment(company.canonicalSlug, {});
        return new RedirectCommand(canonicalUrl, { replaceUrl: true });
      }

      store.resolve(company);
      return true;
    }),
    catchError((error: unknown) => {
      store.fail(slug, error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error');
      return of(true);
    })
  );
}
