import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CustomerFavoritesService } from '../../../core/services/customer-favorites.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Coracao do favorito (Fase 6) no perfil e nos cartoes da vitrine. Com conta, grava ou tira; sem conta, manda para o
 * /entrar e volta para returnUrl com o favorito aplicado (a pagina chama applyPendingIntent).
 */
@Component({
  selector: 'app-favorite-toggle',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="favorite-toggle"
      [class.is-favorite]="isFavorite()"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      [disabled]="isSaving()"
      (click)="toggle()"
    >
      <app-icon name="heart" [size]="size()" />
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .favorite-toggle {
      width: 44px;
      height: 44px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--favorite-border, currentColor);
      border-radius: 50%;
      background: var(--favorite-background, transparent);
      color: var(--favorite-color, currentColor);
      cursor: pointer;
      transition: color 160ms ease, background 160ms ease;
    }

    .favorite-toggle:disabled {
      cursor: progress;
      opacity: 0.7;
    }

    .favorite-toggle.is-favorite {
      color: var(--favorite-active-color, #d6455d);
    }

    .favorite-toggle.is-favorite ::ng-deep svg {
      fill: currentColor;
    }

    .favorite-toggle:focus-visible {
      outline: 2px solid var(--favorite-focus, currentColor);
      outline-offset: 2px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FavoriteToggleComponent {
  private readonly favorites = inject(CustomerFavoritesService);

  readonly slug = input.required<string>();
  readonly companyName = input.required<string>();
  /** Para onde o /entrar volta quando nao ha conta logada (a vitrine ou o perfil). */
  readonly returnUrl = input.required<string>();
  readonly size = input(20);

  readonly isFavorite = computed(() => this.favorites.isFavorite(this.slug()));
  readonly isSaving = computed(() => this.favorites.isSaving(this.slug()));
  readonly label = computed(() => (this.isFavorite() ? `Tirar ${this.companyName()} dos favoritos` : `Favoritar ${this.companyName()}`));

  toggle(): void {
    this.favorites.toggle(this.slug(), this.returnUrl());
  }
}
