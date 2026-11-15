import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { AdminUserRole, StaffCompanies } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { UI_TERMS } from '../../../../core/constants/ui-terms';
import { resolveApiAssetUrl } from '../../../../core/utils/api-asset-url.util';
import { RELOAD_PAGE_AT } from '../../../../core/utils/page-navigation.util';
import { tooManyAttemptsMessage } from '../../../../core/utils/rate-limit-message.util';
import { BrandMarkComponent } from '../../../../shared/components/brand-mark/brand-mark.component';
import { AdminDrawerComponent } from '../admin-drawer/admin-drawer.component';

const ROLE_LABELS: Record<AdminUserRole, string> = {
  [AdminUserRole.Owner]: 'Dono',
  [AdminUserRole.Admin]: 'Administrador',
  [AdminUserRole.Professional]: 'Profissional'
};

/**
 * Troca de empresa sem sair (D3): lista as empresas da conta e entra na escolhida. A sessao da empresa anterior acaba
 * so neste aparelho. A pagina recarrega no painel da nova empresa, para nenhum dado da anterior ficar na tela.
 */
@Component({
  selector: 'app-company-switcher',
  standalone: true,
  imports: [AdminDrawerComponent, BrandMarkComponent],
  templateUrl: './company-switcher.component.html',
  styleUrl: './company-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanySwitcherComponent implements OnInit {
  readonly terms = UI_TERMS;
  readonly title = `Trocar de ${UI_TERMS.company}`;
  /** Esqueleto da lista enquanto as empresas carregam. */
  readonly placeholders = [1, 2];
  readonly closed = output<void>();
  private readonly authService = inject(AuthService);
  private readonly reloadPageAt = inject(RELOAD_PAGE_AT);

  readonly companies = signal<StaffCompanies | null>(null);
  readonly options = computed(() => (this.companies()?.companies ?? []).map((company) => ({
    ...company,
    logo: resolveApiAssetUrl(company.logoUrl) ?? '',
    isCurrent: company.companyId === this.companies()?.currentCompanyId
  })));
  readonly errorMessage = signal<string | null>(null);
  readonly switchingTo = signal<string | null>(null);

  ngOnInit(): void {
    this.authService.listCompanies().subscribe({
      next: (companies) => this.companies.set(companies),
      error: () => this.errorMessage.set(`Não foi possível carregar as ${this.terms.companies} agora.`)
    });
  }

  switchTo(companyId: string): void {
    if (this.switchingTo()) {
      return;
    }

    this.switchingTo.set(companyId);
    this.errorMessage.set(null);
    this.authService.selectCompany(companyId).subscribe({
      next: () => this.reloadPageAt('/admin'),
      error: (error: unknown) => {
        this.errorMessage.set(tooManyAttemptsMessage(error) ?? `Não foi possível trocar de ${this.terms.company} agora.`);
        this.switchingTo.set(null);
      }
    });
  }

  roleLabel(role: AdminUserRole): string {
    return ROLE_LABELS[role] ?? role;
  }
}
