import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { CustomDropdownDirective } from '../../../../shared/directives/custom-dropdown.directive';
import { UI_TERMS } from '../../../../core/constants/ui-terms';
import { CompanySwitcherComponent } from '../company-switcher/company-switcher.component';

/** Conta exibida no cabecalho quando a sessao nao e a do painel da empresa (ex.: plataforma). */
export interface AdminHeaderAccount {
  name: string;
  avatarUrl?: string | null;
  detail?: string | null;
}

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CustomDropdownDirective, IconComponent, RouterLink, CompanySwitcherComponent],
  templateUrl: './admin-header.component.html',
  styleUrl: './admin-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly sidebarCollapsed = input.required<boolean>();
  readonly notificationCount = input(0);
  readonly notificationIcon = input<IconName>('alert-circle');
  readonly notificationRoute = input<string | null>(null);
  readonly profileRoute = input<string | null>(null);
  readonly profileLabel = input('Meu perfil');
  /** Quando informado, substitui o usuario da sessao da empresa e o Sair passa a ser tratado por quem usa o cabecalho. */
  readonly account = input<AdminHeaderAccount | null | undefined>(undefined);
  readonly menuAriaLabel = input('menu administrativo');
  readonly logoutRequested = output<void>();
  readonly toggleDesktopSidebar = output<void>();
  readonly toggleMobileSidebar = output<void>();

  readonly currentUser = computed<AdminHeaderAccount | null>(() => {
    const account = this.account();
    return account === undefined ? this.authService.currentUser() : account;
  });
  readonly isUserMenuOpen = signal(false);
  readonly terms = UI_TERMS;
  /** "Trocar de empresa" so na sessao da equipe com mais de uma empresa na conta (D3). */
  readonly canSwitchCompany = computed(() => this.account() === undefined && (this.authService.currentUser()?.companyCount ?? 1) > 1);
  readonly isCompanySwitcherOpen = signal(false);

  /** Alterna o menu do usuario sem depender do comportamento nativo do details. */
  toggleUserMenu(event: MouseEvent): void {
    event.preventDefault();
    this.isUserMenuOpen.update((isOpen) => !isOpen);
  }

  /** Fecha o menu quando uma acao interna foi escolhida. */
  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  openCompanySwitcher(): void {
    this.closeUserMenu();
    this.isCompanySwitcherOpen.set(true);
  }

  /** Encerra a sessao administrativa usando o AuthService existente. */
  logout(): void {
    this.closeUserMenu();

    if (this.account() !== undefined) {
      this.logoutRequested.emit();
      return;
    }

    this.authService.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
