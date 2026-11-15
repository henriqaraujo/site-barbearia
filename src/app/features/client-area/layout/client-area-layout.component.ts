import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { AdminHeaderAccount, AdminHeaderComponent } from '../../admin/components/admin-header/admin-header.component';
import { AdminSidebarComponent } from '../../admin/components/admin-sidebar/admin-sidebar.component';
import { AdminNavigationItem } from '../../admin/models/admin-navigation.model';
import { AdminSidebarStateService } from '../../admin/services/admin-sidebar-state.service';
import { injectCompactLayout } from '../../my-account/components/company-picker/compact-layout';
import { MyAccountCompanyPickerComponent } from '../../my-account/components/company-picker/my-account-company-picker.component';
import { ClientNoMembershipComponent } from '../components/client-no-membership/client-no-membership.component';
import { ClientLoyaltyApiService } from '../services/client-loyalty-api.service';
import { TermPipe } from '../../../shared/pipes/term.pipe';

@Component({
  selector: 'app-client-area-layout',
  standalone: true,
  imports: [TermPipe, RouterOutlet, AdminHeaderComponent, AdminSidebarComponent, ClientNoMembershipComponent, MyAccountCompanyPickerComponent],
  templateUrl: './client-area-layout.component.html',
  styleUrl: './client-area-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientAreaLayoutComponent implements OnInit {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly sidebarState = inject(AdminSidebarStateService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly loyaltyApiService = inject(ClientLoyaltyApiService);

  readonly currentUser = this.customerSessions.currentCustomer;
  /**
   * Vinculo da conta com esta empresa (conferido pelo clientGuard antes de abrir). Sem vinculo, a area abre com o
   * estado vazio no lugar das telas, que dependem dele; abrir a area nao cria vinculo (Fase 3, item 7).
   */
  readonly hasMembership = computed(() => this.currentUser() !== null);
  readonly companyName = this.companyContextService.fullName;
  readonly companySlug = this.companyContextService.companySlug;
  readonly companyLogoUrl = this.companyContextService.logoUrl;
  /** Celular: a troca de empresa desce para logo abaixo do topo, como na /minha-conta. */
  readonly compact = injectCompactLayout();
  /** Cabecalho mostra o cliente desta empresa ou, sem vinculo, a conta; o Sair encerra a conta neste aparelho. */
  readonly headerAccount = computed<AdminHeaderAccount | null>(() => {
    const customer = this.currentUser();
    if (customer) {
      return { name: customer.name, detail: customer.email };
    }

    const account = this.customerSessions.account();
    return account ? { name: account.fullName, detail: account.email } : null;
  });
  readonly sidebarCollapsed = this.sidebarState.desktopCollapsed;
  readonly mobileSidebarOpened = this.sidebarState.mobileOpened;
  readonly sidebarWidth = this.sidebarState.desktopWidth;
  /**
   * "Meus pontos" so aparece com o programa de fidelidade ligado. Notificacoes e Meu perfil ficam fora enquanto usam
   * dados falsos (mock em memoria); as rotas antigas voltam para o Inicio (client-area.routes.ts).
   */
  readonly navigationItems = computed<readonly AdminNavigationItem[]>(() => {
    const home: AdminNavigationItem = { label: 'Início', route: this.companyContextService.publicUrl('cliente'), icon: 'layout-dashboard', exact: true };
    // A volta para a /minha-conta (Fase 4) fica na troca de empresa do topo; os dados da conta, no menu da pessoa.
    // Sem vinculo, as outras telas nao tem o que mostrar: so o Inicio, com o estado vazio.
    if (!this.hasMembership()) {
      return [home];
    }

    return [
      home,
      { label: 'Meus agendamentos', route: this.companyContextService.publicUrl('cliente/agendamentos'), icon: 'calendar', exact: true },
      { label: 'Histórico', route: this.companyContextService.publicUrl('cliente/historico'), icon: 'clock', exact: true },
      { label: 'Meu plano', route: this.companyContextService.publicUrl('cliente/meu-plano'), icon: 'credit-card', exact: true },
      ...(this.loyaltyApiService.summary()?.programEnabled
        ? [{ label: 'Meus pontos', route: this.companyContextService.publicUrl('cliente/fidelidade'), icon: 'star' as const, exact: true }]
        : [])
    ];
  });

  /** Carrega a identidade publica da empresa para a area do cliente exibir a marca do tenant, nao a da plataforma. */
  ngOnInit(): void {
    this.companyContextService.loadPublicCompany(this.companyContextService.companySlug()).subscribe({ error: () => undefined });
    if (this.hasMembership()) {
      this.loyaltyApiService.loadSummary(this.companyContextService.companySlug());
    }
  }

  /** Sai da conta neste aparelho (vale para todas as empresas) e volta para o site desta. */
  logout(): void {
    this.customerSessions.logout().subscribe(() => void this.router.navigateByUrl(this.companyContextService.publicUrl()));
  }

  /** Alterna a largura da sidebar usando o mesmo estado do painel administrativo. */
  toggleDesktopSidebar(): void {
    this.sidebarState.toggleDesktopCollapsed();
  }

  /** Alterna o drawer mobile usando o mesmo comportamento do painel administrativo. */
  toggleMobileMenu(): void {
    this.sidebarState.toggleMobile();
  }

  /** Fecha o drawer mobile depois da navegacao ou backdrop. */
  closeMobileMenu(): void {
    this.sidebarState.closeMobile();
  }
}
