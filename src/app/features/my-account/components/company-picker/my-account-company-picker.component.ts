import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { CustomDropdownDirective } from '../../../../shared/directives/custom-dropdown.directive';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { MyAccountCompany } from '../../models/my-account.model';
import { companyInitial, companyLogo } from '../../my-account-format';
import { MyAccountApiService } from '../../services/my-account-api.service';

/**
 * Troca de empresa no topo da /minha-conta e da area do cliente: "Minha conta" (visao geral) e as empresas da conta,
 * com logo e nome. Escolher leva ao Inicio da opcao (/minha-conta ou /{slug}/cliente); a opcao atual so fecha a lista.
 * Abre sempre, mesmo com uma empresa so.
 */
@Component({
  selector: 'app-my-account-company-picker',
  standalone: true,
  imports: [NgTemplateOutlet, CustomDropdownDirective, IconComponent],
  templateUrl: './my-account-company-picker.component.html',
  styleUrl: './my-account-company-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountCompanyPickerComponent {
  private readonly api = inject(MyAccountApiService);
  private readonly router = inject(Router);

  /** Empresa da area do cliente aberta; nulo na /minha-conta ("Minha conta"). */
  readonly currentSlug = input<string | null>(null);
  /** Nome e logo da empresa aberta, para o topo quando a conta nao tem vinculo com ela (fora da lista). */
  readonly currentName = input('');
  readonly currentLogoUrl = input('');

  readonly companies = signal<MyAccountCompany[]>([]);
  readonly loaded = signal(false);
  readonly current = computed<MyAccountCompany | null>(() => {
    const slug = this.currentSlug();
    if (!slug) {
      return null;
    }

    return this.companies().find((company) => company.slug === slug) ?? { slug, name: this.currentName(), logoUrl: this.currentLogoUrl() };
  });
  /** Na /minha-conta sem empresas nao ha para onde ir; na area do cliente sempre ha a volta para "Minha conta". */
  readonly visible = computed(() => this.currentSlug() !== null || (this.loaded() && this.companies().length > 0));
  readonly isOpen = signal(false);
  readonly logo = companyLogo;
  readonly initial = companyInitial;

  constructor() {
    // Lista que falhou: o seletor ainda leva para "Minha conta" (e para a empresa aberta).
    this.api.companies().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true)
    });
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  choose(company: MyAccountCompany | null): void {
    this.isOpen.set(false);
    const slug = company?.slug ?? null;
    if (slug === this.currentSlug()) {
      return;
    }

    void this.router.navigateByUrl(slug ? `/${slug}/cliente` : '/minha-conta');
  }
}
