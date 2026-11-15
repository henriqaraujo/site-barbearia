import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PLATFORM_BRAND } from '../../../core/constants/platform-brand.constants';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { AdminHeaderAccount, AdminHeaderComponent } from '../../admin/components/admin-header/admin-header.component';
import { AdminSidebarComponent } from '../../admin/components/admin-sidebar/admin-sidebar.component';
import { AdminNavigationItem } from '../../admin/models/admin-navigation.model';
import { AdminSidebarStateService } from '../../admin/services/admin-sidebar-state.service';
import { injectCompactLayout } from '../components/company-picker/compact-layout';
import { MyAccountCompanyPickerComponent } from '../components/company-picker/my-account-company-picker.component';

/**
 * /minha-conta (Fase 4): a area global da conta do cliente, na mesma casca da area do cliente de cada empresa, com a
 * marca do HL Gestao (a conta e da plataforma, nao de uma empresa). No topo, a troca de empresa leva a area do
 * cliente de cada empresa (no celular, logo abaixo do topo).
 */
@Component({
  selector: 'app-my-account-layout',
  standalone: true,
  imports: [RouterOutlet, AdminHeaderComponent, AdminSidebarComponent, MyAccountCompanyPickerComponent],
  templateUrl: './my-account-layout.component.html',
  styleUrl: '../../client-area/layout/client-area-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountLayoutComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly sidebarState = inject(AdminSidebarStateService);

  readonly brand = PLATFORM_BRAND;
  readonly headerAccount = computed<AdminHeaderAccount | null>(() => {
    const account = this.customerSessions.account();
    return account ? { name: account.fullName, detail: account.email } : null;
  });
  readonly sidebarCollapsed = this.sidebarState.desktopCollapsed;
  readonly mobileSidebarOpened = this.sidebarState.mobileOpened;
  readonly sidebarWidth = this.sidebarState.desktopWidth;
  readonly compact = injectCompactLayout();
  readonly navigationItems: readonly AdminNavigationItem[] = [
    { label: 'Início', route: '/minha-conta', icon: 'layout-dashboard', exact: true },
    { label: 'Agendar', route: '/minha-conta/agendar', icon: 'calendar', exact: true },
    { label: 'Meus agendamentos', route: '/minha-conta/agendamentos', icon: 'clock', exact: true },
    { label: 'Favoritos', route: '/minha-conta/favoritos', icon: 'heart', exact: true },
    { label: 'Dados da conta', route: '/minha-conta/dados', icon: 'user', exact: true }
  ];

  /** Sai da conta neste aparelho e volta para a pagina inicial. */
  logout(): void {
    this.customerSessions.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }

  toggleDesktopSidebar(): void {
    this.sidebarState.toggleDesktopCollapsed();
  }

  toggleMobileMenu(): void {
    this.sidebarState.toggleMobile();
  }

  closeMobileMenu(): void {
    this.sidebarState.closeMobile();
  }
}
