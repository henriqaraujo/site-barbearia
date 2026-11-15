import { Injectable, computed, signal } from '@angular/core';
import { PublicCompany } from '../models/public-booking-api.model';

/**
 * - `none`: rota sem empresa (/, /login da equipe, /admin, /platform);
 * - `loading`: resolvendo o slug da URL;
 * - `ready`: empresa ativa;
 * - `inactive`: empresa existe, mas esta desativada (so a identidade e exibida);
 * - `not-found`: slug fora do formato ou sem empresa;
 * - `error`: falha de rede ou do servidor ao resolver.
 */
export type TenantStatus = 'none' | 'loading' | 'ready' | 'inactive' | 'not-found' | 'error';

/**
 * Empresa da URL atual. Preenchida SOMENTE pelo tenantGuard a partir do segmento /:companySlug: nada de
 * localStorage, configuracao de build ou sessao decide qual barbearia a tela mostra.
 */
@Injectable({ providedIn: 'root' })
export class TenantContextStore {
  private readonly slugValue = signal<string | null>(null);
  private readonly companyValue = signal<PublicCompany | null>(null);
  private readonly statusValue = signal<TenantStatus>('none');

  readonly slug = this.slugValue.asReadonly();
  readonly company = this.companyValue.asReadonly();
  readonly status = this.statusValue.asReadonly();
  readonly isReady = computed(() => this.statusValue() === 'ready');

  startLoading(slug: string): void {
    this.slugValue.set(slug);
    this.companyValue.set(null);
    this.statusValue.set('loading');
  }

  resolve(company: PublicCompany): void {
    this.slugValue.set(company.canonicalSlug);
    this.companyValue.set(company);
    this.statusValue.set(company.isActive ? 'ready' : 'inactive');
  }

  fail(slug: string, status: 'not-found' | 'error'): void {
    this.slugValue.set(slug);
    this.companyValue.set(null);
    this.statusValue.set(status);
  }

  clear(): void {
    this.slugValue.set(null);
    this.companyValue.set(null);
    this.statusValue.set('none');
  }
}
