import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { take } from 'rxjs';
import { PLATFORM_BRAND } from '../../core/constants/platform-brand.constants';
import { AuthService } from '../../core/services/auth.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { CustomerSessionService } from '../../core/services/customer-session.service';
import { CustomDropdownDirective } from '../../shared/directives/custom-dropdown.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';

/**
 * Cabecalho da plataforma (pedido do dono em 07/10, no estilo do AppBarber), na vitrine e nas paginas publicas da
 * empresa: marca da HL Gestao, Inicio, Buscar e Meus agendamentos; a direita "Area da equipe" e "Entrar" ou o menu da
 * conta. A marca da empresa fica no conteudo da pagina (perfil), nao aqui.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, CustomDropdownDirective],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly router = inject(Router);

  readonly brand = PLATFORM_BRAND;
  readonly hasScrolled = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly isAccountMenuOpen = signal(false);
  readonly navigation = [
    { label: 'Início', route: '/', exact: true },
    { label: 'Buscar', route: '/buscar', exact: true },
    { label: 'Meus agendamentos', route: '/minha-conta/agendamentos', exact: false }
  ] as const;

  /** Pagina de uma empresa (/{slug}/...): o menu da conta ganha a area do cliente dela e o "Entrar" usa o login dela. */
  readonly hasCompany = computed(() => Boolean(this.companyContextService.companySlug()));
  /** Conta do cliente logada (vale em todas as empresas) ou alguem da equipe logado no painel. */
  readonly isAuthenticated = computed(() => this.customerSessions.isAccountAuthenticated() || this.authService.isAuthenticated());
  readonly isCustomerAccount = this.customerSessions.isAccountAuthenticated;
  readonly firstName = computed(() =>
    this.getFirstName(this.customerSessions.currentCustomer()?.name ?? this.customerSessions.account()?.fullName ?? this.authService.currentUser()?.name));
  readonly accountLabel = computed(() => this.firstName() || 'Minha conta');
  readonly accountAriaLabel = computed(() => (this.firstName() ? `Abrir menu da conta de ${this.firstName()}` : 'Abrir menu da minha conta'));
  readonly loginRoute = computed(() => (this.hasCompany() ? this.companyContextService.publicUrl('login') : '/entrar'));
  readonly clientAreaRoute = computed(() => this.companyContextService.publicUrl('cliente'));

  /** Marca o item pelo caminho, ignorando a query (/buscar?q=... continua "Buscar"). */
  activeOptions(exact: boolean): IsActiveMatchOptions {
    return { paths: exact ? 'exact' : 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.hasScrolled.set(window.scrollY > 8);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
    if (!this.isMobileMenuOpen()) {
      this.closeAccountMenu();
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  toggleAccountMenu(): void {
    if (this.isAuthenticated()) {
      this.isAccountMenuOpen.set(!this.isAccountMenuOpen());
    }
  }

  /** Sincroniza o estado do dropdown com a diretiva compartilhada de clique fora e Escape. */
  setAccountMenuOpen(isOpen: boolean): void {
    this.isAccountMenuOpen.set(isOpen);
  }

  closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  go(route: string): void {
    this.closeAccountMenu();
    this.closeMobileMenu();
    void this.router.navigateByUrl(route);
  }

  /** Painel da equipe logada (a area autorizada dela). */
  staffArea(): string {
    return this.authService.getAuthenticatedHomeUrl();
  }

  /** Sai da conta do cliente neste aparelho (ou da sessao da equipe) e volta para a pagina publica atual. */
  handleLogout(): void {
    this.closeAccountMenu();
    this.closeMobileMenu();
    const logout$ = this.customerSessions.isAccountAuthenticated() ? this.customerSessions.logout() : this.authService.logout();
    logout$.pipe(take(1)).subscribe(() => {
      void this.router.navigateByUrl(this.hasCompany() ? this.companyContextService.publicUrl() : '/');
    });
  }

  private getFirstName(fullName: string | null | undefined): string {
    return fullName?.trim().split(/\s+/)[0] ?? '';
  }
}
