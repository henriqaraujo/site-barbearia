import { InjectionToken } from '@angular/core';

/**
 * Carrega a pagina de novo num endereco (ex.: painel da empresa nova depois da troca de empresa), para nenhum dado da
 * empresa anterior ficar em memoria. Os testes trocam por um espiao.
 */
export const RELOAD_PAGE_AT = new InjectionToken<(url: string) => void>('RELOAD_PAGE_AT', {
  providedIn: 'root',
  factory: () => (url: string) => window.location.assign(url)
});
