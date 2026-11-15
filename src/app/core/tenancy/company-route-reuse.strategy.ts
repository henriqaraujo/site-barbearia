import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Trocar de empresa na URL (/a/... -> /b/...) recria as telas da empresa em vez de reaproveita-las. Sem isso, o Angular
 * mantem a mesma instancia (mesma rota, outro :companySlug) e telas que carregam no ngOnInit (Inicio e menu da area do
 * cliente, por exemplo) ficariam com os dados da empresa anterior. O seletor de empresa do topo troca assim.
 */
@Injectable()
export class CompanyRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return super.shouldReuseRoute(future, current) && future.params['companySlug'] === current.params['companySlug'];
  }
}
