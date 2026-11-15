import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PLATFORM_BRAND } from '../../../core/constants/platform-brand.constants';
import { CompanyContextService } from '../../../core/services/company-context.service';

/**
 * Topo das telas de conta no padrao do HL CRM (referencia do dono, 06/10/2026): logo pequena, titulo serifado e o nome
 * embaixo. No endereco de uma empresa (/{slug}/...) a marca e a dela (logo e nome); fora dele (/entrar e a redefinicao
 * de senha sem empresa) e a do HL Gestao.
 */
@Component({
  selector: 'app-auth-brand',
  standalone: true,
  templateUrl: './auth-brand.component.html',
  styleUrl: './auth-brand.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthBrandComponent {
  readonly title = input.required<string>();
  /** Id do titulo, para o aria-labelledby da secao da tela. */
  readonly titleId = input.required<string>();
  /** A tela esta no endereco de uma empresa (/{slug}/...). Vem da rota da tela: o contexto guarda a ultima empresa. */
  readonly isCompany = input.required<boolean>();

  private readonly companyContextService = inject(CompanyContextService);
  /** Empresa sem logo enviada: so o nome (nunca uma imagem provisoria de outra marca). */
  readonly logoUrl = computed(() => this.isCompany() ? this.companyContextService.logoUrl() || null : PLATFORM_BRAND.iconUrl);
  readonly name = computed(() => this.isCompany() ? this.companyContextService.fullName() || this.companyContextService.name() : PLATFORM_BRAND.name);
}
