import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { UI_TERMS } from '../../core/constants/ui-terms';
import { PublicCompany, PublicCompanyMedia, PublicCompanyMediaSlot, PublicProfessional, PublicService } from '../../core/models/public-booking-api.model';
import { Product } from '../../core/models/product.model';
import { PublicSubscriptionPlan } from '../../core/models/public-subscription.model';
import { CompanyContextService } from '../../core/services/company-context.service';
import { CustomerFavoritesService } from '../../core/services/customer-favorites.service';
import { CustomerSessionService } from '../../core/services/customer-session.service';
import { PublicBookingApiService } from '../../core/services/public-booking-api.service';
import { PublicCompanyStateService } from '../../core/services/public-company-state.service';
import { PublicProductsApiService } from '../../core/services/public-products-api.service';
import { PublicSubscriptionsApiService } from '../../core/services/public-subscriptions-api.service';
import { resolveApiMediaUrl } from '../../core/utils/api-media-url.util';
import { companyAddressText, companyMapsUrl, companyWhatsappUrl } from '../../core/utils/company-contact-links';
import { summarizeBusinessHours } from '../../core/utils/business-hours-summary';
import { joinNames } from '../../core/utils/plan-professionals.util';
import { FavoriteToggleComponent } from '../../shared/components/favorite-toggle/favorite-toggle.component';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { TermPipe } from '../../shared/pipes/term.pipe';

type ProfileTab = 'servicos' | 'profissionais' | 'planos' | 'produtos';

interface GalleryPhoto {
  readonly url: string;
  readonly alt: string;
}

/** Imagens da Identidade visual que viram galeria, na ordem em que aparecem (so as que a empresa enviou). */
const GALLERY_SLOTS: readonly { slot: PublicCompanyMediaSlot; alt: string }[] = [
  { slot: 'HeroOpening', alt: 'Fachada' },
  { slot: 'HeroSalon', alt: 'Salão' },
  { slot: 'HeroChairs', alt: 'Área de atendimento' },
  { slot: 'AboutPrimary', alt: 'Ambiente' },
  { slot: 'AboutDetail', alt: 'Detalhe do ambiente' },
  { slot: 'GalleryEntrance', alt: 'Entrada' },
  { slot: 'GalleryChairs', alt: 'Cadeiras' },
  { slot: 'GalleryReception', alt: 'Recepção' },
  { slot: 'GallerySalon', alt: 'Salão' },
  { slot: 'GalleryComfort', alt: 'Conforto' }
];

/**
 * Perfil da empresa em /{slug} (Fase 5, D9), no lugar da home de marketing: cabecalho com logo, nome, bairro e cidade e
 * "Agendar agora"; galeria com as imagens da Identidade visual (so as enviadas, sem foto de exemplo); abas Servicos,
 * Profissionais, Planos e Produtos; lateral com Localizacao, Horario, Contato e Redes. Mostra o mesmo que a home ja
 * mostrava (V5), com dados sempre da API (D6). "Agendar" de um servico ou profissional pre-seleciona no agendamento (D8).
 */
@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [TermPipe, RouterLink, FavoriteToggleComponent, ImageFallbackDirective],
  templateUrl: './company-profile.component.html',
  styleUrl: './company-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyProfileComponent implements OnInit {
  readonly terms = UI_TERMS;
  private readonly companyContextService = inject(CompanyContextService);
  private readonly publicCompanyStateService = inject(PublicCompanyStateService);
  private readonly publicBookingApiService = inject(PublicBookingApiService);
  private readonly publicProductsApiService = inject(PublicProductsApiService);
  private readonly publicSubscriptionsApiService = inject(PublicSubscriptionsApiService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly favorites = inject(CustomerFavoritesService);

  /** Slug atual da empresa (o endereco antigo ja redirecionou). */
  readonly slug = this.companyContextService.companySlug();
  readonly favoriteError = this.favorites.errorMessage;

  readonly company = signal<PublicCompany | null>(null);
  readonly companyError = signal(false);
  readonly services = signal<readonly PublicService[] | null>(null);
  readonly professionals = signal<readonly PublicProfessional[] | null>(null);
  readonly plans = signal<readonly PublicSubscriptionPlan[]>([]);
  readonly products = signal<readonly Product[]>([]);
  readonly activeTab = signal<ProfileTab>('servicos');

  readonly name = computed(() => this.company()?.name ?? '');
  readonly logoUrl = computed(() => this.companyContextService.logoUrl());
  readonly place = computed(() => {
    const address = this.company()?.address;
    if (!address?.city) {
      return '';
    }

    return [address.neighborhood, `${address.city}/${address.state}`].filter(Boolean).join(' · ');
  });
  readonly description = computed(() => this.company()?.description?.trim() ?? '');
  /** Fotos cujo arquivo nao carregou (upload ausente no storage): saem da galeria em vez de aparecer quebradas. */
  private readonly failedPhotos = signal<ReadonlySet<string>>(new Set());
  readonly gallery = computed<readonly GalleryPhoto[]>(() => {
    const media = this.company()?.media ?? [];
    return GALLERY_SLOTS
      .map(({ slot, alt }) => ({ item: media.find((candidate: PublicCompanyMedia) => candidate.slot === slot && candidate.isConfigured && candidate.imageUrl), alt }))
      .filter((entry): entry is { item: PublicCompanyMedia; alt: string } => entry.item !== undefined)
      .map(({ item, alt }) => ({ url: resolveApiMediaUrl(item.imageUrl), alt }))
      .filter((photo) => !this.failedPhotos().has(photo.url));
  });
  readonly tabs = computed(() => [
    { id: 'servicos' as const, label: 'Serviços', count: this.services()?.length ?? 0 },
    { id: 'profissionais' as const, label: 'Profissionais', count: this.professionals()?.length ?? 0 },
    { id: 'planos' as const, label: 'Planos', count: this.plans().length },
    { id: 'produtos' as const, label: 'Produtos', count: this.products().length }
  ].filter((tab) => tab.id === 'servicos' || tab.count > 0));
  readonly address = computed(() => companyAddressText(this.company()));
  readonly mapsUrl = computed(() => companyMapsUrl(this.company()));
  readonly whatsappUrl = computed(() => companyWhatsappUrl(this.company()));
  readonly instagramUrl = computed(() => {
    const profile = (this.company()?.instagram ?? '').replace('@', '').trim();
    return profile ? `https://www.instagram.com/${encodeURIComponent(profile)}/` : null;
  });
  /** Horario resumido: dias seguidos com o mesmo horario numa linha so (pedido do dono, 07/10). */
  readonly hours = computed(() => summarizeBusinessHours(this.company()?.businessHours ?? []));

  ngOnInit(): void {
    const slug = this.slug;
    // Fase 6: coracao com a lista da conta; na volta do /entrar, aplica o favorito pedido nesta pagina (F4).
    this.favorites.ensureLoaded();
    this.favorites.applyPendingIntent(slug);
    this.publicCompanyStateService.getCompany().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (company) => this.company.set(company),
      error: () => this.companyError.set(true)
    });
    this.publicBookingApiService.getServices(slug).pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((services) => this.services.set(services));
    this.publicBookingApiService.getProfessionals(slug).pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((professionals) => this.professionals.set(professionals));
    this.publicSubscriptionsApiService.getSubscriptionPlans(slug).pipe(catchError(() => of<PublicSubscriptionPlan[]>([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((plans) => this.plans.set(plans));
    this.publicProductsApiService.getProducts(slug).pipe(catchError(() => of<Product[]>([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => this.products.set(products));
  }

  photoFailed(url: string): void {
    this.failedPhotos.update((failed) => new Set(failed).add(url));
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  profileUrl(): string {
    return this.companyContextService.publicUrl();
  }

  bookingUrl(): string {
    return this.companyContextService.publicUrl('agendamento');
  }

  imageUrl(url: string | null): string {
    return resolveApiMediaUrl(url);
  }

  initial(): string {
    return this.name().trim().charAt(0).toUpperCase();
  }

  price(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Contratar plano: logado vai direto; sem conta, passa pelo login e volta para a contratacao. */
  planRoute(planId: string): string {
    return this.customerSessions.isAccountAuthenticated()
      ? this.companyContextService.publicUrl(`assinatura/contratar/${planId}`)
      : this.companyContextService.publicUrl('login');
  }

  planQueryParams(planId: string): Record<string, string> | null {
    return this.customerSessions.isAccountAuthenticated() ? null : { returnUrl: this.companyContextService.publicUrl(`assinatura/contratar/${planId}`) };
  }

  productWhatsappUrl(product: Product): string | null {
    return companyWhatsappUrl(this.company(), `Olá! Tenho interesse no produto ${product.name}.`);
  }

  benefitsText(plan: PublicSubscriptionPlan): string {
    return joinNames(plan.benefits.map((benefit) => `${benefit.quantityPerPeriod} ${benefit.serviceName}`));
  }

  billingLabel(plan: PublicSubscriptionPlan): string {
    return plan.billingPeriod === 'Monthly' ? 'mês' : plan.billingPeriod;
  }
}
