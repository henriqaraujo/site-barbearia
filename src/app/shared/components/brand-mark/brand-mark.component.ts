import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { brandInitials } from '../../../core/utils/brand-initials';

export type BrandMarkVariant = 'full' | 'short';

/**
 * Marca unica da empresa nos tres layouts (site publico, area do cliente e painel). 'full': o logo sozinho ou, sem
 * logo, as iniciais e o nome completo. 'short' (sidebars): logo pequeno ou iniciais e o nome curto, com reticencias e
 * o nome completo no title. O fallback do nome curto ja vem resolvido da API (displayShortName, D5).
 */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  templateUrl: './brand-mark.component.html',
  styleUrl: './brand-mark.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandMarkComponent {
  /** Nome completo da empresa. */
  readonly name = input.required<string>();
  /** Nome curto (variant 'short'); vazio usa o nome completo. */
  readonly shortName = input('');
  readonly logoUrl = input('');
  readonly variant = input<BrandMarkVariant>('full');
  /** Sidebar recolhida esconde o texto: fica so o icone, com o nome no aria-label e no title. */
  readonly showText = input(true);
  readonly tag = input<string | null>(null);

  /** Empresa ainda carregando (sem nome nem logo): esqueleto, nunca um nome provisorio. */
  readonly loading = computed(() => !this.name().trim() && !this.logoUrl());
  readonly initials = computed(() => brandInitials(this.name()));
  readonly label = computed(() => (this.variant() === 'short' && this.shortName()) || this.name());
  readonly showsLogoAlone = computed(() => this.variant() === 'full' && !!this.logoUrl());
  readonly title = computed(() => (this.variant() === 'short' || !this.showText() ? this.name() : null));
}
