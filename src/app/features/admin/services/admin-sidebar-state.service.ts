import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminSidebarStateService {
  private readonly desktopCollapsedValue = signal(false);
  private readonly mobileOpenedValue = signal(false);

  readonly desktopCollapsed = this.desktopCollapsedValue.asReadonly();
  readonly mobileOpened = this.mobileOpenedValue.asReadonly();
  readonly desktopWidth = computed(() => (this.desktopCollapsedValue() ? '5rem' : '17rem'));

  /** Alterna a sidebar recolhida no desktop. */
  toggleDesktopCollapsed(): void {
    this.desktopCollapsedValue.update((isCollapsed) => !isCollapsed);
  }

  /** Abre a sidebar como drawer em telas menores. */
  openMobile(): void {
    this.mobileOpenedValue.set(true);
  }

  /** Fecha a sidebar mobile sem alterar o estado desktop. */
  closeMobile(): void {
    this.mobileOpenedValue.set(false);
  }

  /** Alterna a abertura do drawer mobile. */
  toggleMobile(): void {
    this.mobileOpenedValue.update((isOpened) => !isOpened);
  }
}
