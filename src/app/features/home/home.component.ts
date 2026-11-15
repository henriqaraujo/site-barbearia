import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { BUSINESS_INFORMATION } from '../../core/constants/business.constants';
import { BusinessInformation } from '../../core/models/business-information.model';
import { GalleryImage } from '../../core/models/gallery-image.model';
import { Product } from '../../core/models/product.model';
import { Professional } from '../../core/models/professional.model';
import { PublicCompanyMedia, PublicCompanyMediaSlot, PublicProfessional, PublicService } from '../../core/models/public-booking-api.model';
import { PublicSubscriptionPlan } from '../../core/models/public-subscription.model';
import { BarberService } from '../../core/models/service.model';
import { CustomerSessionService } from '../../core/services/customer-session.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { PublicCompanyStateService } from '../../core/services/public-company-state.service';
import { PublicBookingApiService } from '../../core/services/public-booking-api.service';
import { PublicProductsApiService } from '../../core/services/public-products-api.service';
import { companyWhatsappUrl } from '../../core/utils/company-contact-links';
import { PublicSubscriptionsApiService } from '../../core/services/public-subscriptions-api.service';
import { mapPublicCompanyToBusinessInformation } from '../../core/utils/public-company-business-information.mapper';
import { IconName } from '../../shared/components/icon/icon.component';
import { CloseButtonComponent } from '../../shared/components/close-button/close-button.component';
import { BrandCutLineComponent } from '../../shared/components/brand-cut-line/brand-cut-line.component';
import { RevealOnScrollDirective } from '../../shared/directives/reveal-on-scroll.directive';
import { GALLERY_IMAGES } from './data/gallery.mock';
import { TenantUrlPipe } from '../../core/tenancy/tenant-url.pipe';
import { resolveApiMediaUrl } from '../../core/utils/api-media-url.util';
import { joinNames } from '../../core/utils/plan-professionals.util';

interface HeroSlide {
  readonly imageUrl: string;
  readonly alt: string;
  readonly slot: PublicCompanyMediaSlot;
  readonly fallbackImageUrl?: string;
}

interface ExperienceItem {
  readonly title: string;
  readonly description: string;
  readonly icon: IconName;
}

const SERVICE_PLACEHOLDER_IMAGE_URL = '/assets/fotos/placeholder-ambiente.svg';

const DEFAULT_HERO_SLIDES: readonly HeroSlide[] = [
  {
    slot: 'HeroOpening',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    alt: 'Entrada'
  },
  {
    slot: 'HeroSalon',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    alt: 'Salão principal'
  },
  {
    slot: 'HeroChairs',
    imageUrl: '/assets/fotos/placeholder-ambiente.svg',
    alt: 'Área de atendimento'
  }
];

const GALLERY_MEDIA_SLOTS: Record<string, PublicCompanyMediaSlot> = {
  entrada: 'GalleryEntrance',
  cadeiras: 'GalleryChairs',
  recepcao: 'GalleryReception',
  salao: 'GallerySalon',
  frigobar: 'GalleryComfort'
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, BrandCutLineComponent, CloseButtonComponent, RevealOnScrollDirective, ImageFallbackDirective, TenantUrlPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly presentation = inject(ActivatedRoute).snapshot.data['presentation'] === true;
  readonly joinNames = joinNames;
  private readonly domSanitizer = inject(DomSanitizer);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly publicBookingApiService = inject(PublicBookingApiService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly publicCompanyStateService = inject(PublicCompanyStateService);
  private readonly publicProductsApiService = inject(PublicProductsApiService);
  private readonly publicSubscriptionsApiService = inject(PublicSubscriptionsApiService);
  readonly services = signal<readonly BarberService[]>([]);
  readonly professionals = signal<readonly Professional[]>([]);
  readonly products = signal<readonly Product[]>([]);
  readonly subscriptionPlans = signal<readonly PublicSubscriptionPlan[]>([]);
  readonly companyMedia = signal<readonly PublicCompanyMedia[]>([]);
  readonly isLoadingCompany = signal(false);
  readonly isLoadingServices = signal(false);
  readonly isLoadingProfessionals = signal(false);
  readonly isLoadingProducts = signal(false);
  readonly isLoadingSubscriptionPlans = signal(false);
  readonly companyErrorMessage = signal('');
  readonly servicesErrorMessage = signal('');
  readonly professionalsErrorMessage = signal('');
  readonly productsErrorMessage = signal('');
  readonly subscriptionPlansErrorMessage = signal('');
  readonly businessInformation = signal<BusinessInformation>(BUSINESS_INFORMATION);
  /** Nome cadastrado da empresa; vazio enquanto carrega (esqueleto ou frase sem nome, nunca um nome provisorio). */
  readonly companyName = computed(() => this.businessInformation().name.trim());
  /** Mapa do endereco da barbearia; sem endereco cadastrado nao ha mapa. */
  googleMapsEmbedUrl: SafeResourceUrl | null = null;
  readonly selectedProduct = signal<Product | null>(null);
  /** WhatsApp da barbearia sobre o produto aberto; null sem numero cadastrado (o botao some). */
  readonly selectedProductWhatsappUrl = computed(() => {
    const product = this.selectedProduct();
    return product ? companyWhatsappUrl(this.companyContextService.publicCompany(), `Olá! Tenho interesse no produto ${product.name}.`) : null;
  });
  readonly selectedGalleryImage = signal<GalleryImage | null>(null);
  readonly activeSlideIndex = signal(0);
  readonly highlightedServiceIndex = signal(0);
  readonly selectedProfessionalIndex = signal(0);
  readonly currentSlideNumber = computed(() => String(this.activeSlideIndex() + 1).padStart(2, '0'));
  readonly totalSlideNumber = computed(() => String(this.heroSlides().length).padStart(2, '0'));
  readonly highlightedService = computed(() => this.services()[this.highlightedServiceIndex()] ?? null);
  readonly selectedProfessionalProfile = computed(() => this.professionals()[this.selectedProfessionalIndex()] ?? null);
  readonly heroSlides = computed<readonly HeroSlide[]>(() => this.presentation ? [
    { slot: 'HeroOpening', imageUrl: '/assets/fotos/apresentacao/466799909_17957726987838563_7070470414627991170_n.jpg', alt: 'Interior da barbearia' },
    { slot: 'HeroSalon', imageUrl: '/assets/fotos/apresentacao/hestory_5.png', alt: 'Atendimento na barbearia' },
    { slot: 'HeroChairs', imageUrl: '/assets/fotos/apresentacao/485151397_17972504102838563_5528938866140468801_n.jpg', alt: 'Detalhe da recepção' }
  ] : DEFAULT_HERO_SLIDES.map((slide) => ({
    ...slide,
    imageUrl: this.getCompanyMediaUrl(slide.slot, slide.imageUrl),
    fallbackImageUrl: slide.imageUrl
  })));
  readonly aboutPrimaryImageUrl = computed(() => this.presentation ? '/assets/fotos/apresentacao/hestory_4.png' : this.getCompanyMediaUrl('AboutPrimary', '/assets/fotos/placeholder-ambiente.svg'));
  readonly aboutDetailImageUrl = computed(() => this.presentation ? '/assets/fotos/apresentacao/485151397_17972504102838563_5528938866140468801_n.jpg' : this.getCompanyMediaUrl('AboutDetail', '/assets/fotos/placeholder-ambiente.svg'));
  readonly ritualBackgroundImageUrl = computed(() => this.presentation ? '/assets/fotos/apresentacao/hestory_5.png' : this.getCompanyMediaUrl('RitualBackground', '/assets/fotos/placeholder-ambiente.svg'));
  readonly bookingCtaBackgroundImageUrl = computed(() => this.presentation ? '/assets/fotos/apresentacao/466799909_17957726987838563_7070470414627991170_n.jpg' : this.getCompanyMediaUrl('BookingCtaBackground', '/assets/fotos/placeholder-ambiente.svg'));
  readonly galleryImages = computed<readonly GalleryImage[]>(() => GALLERY_IMAGES.map((galleryImage) => ({
    ...galleryImage,
    imageUrl: this.presentation ? ({ entrada: '/assets/fotos/apresentacao/482558589_18493625881048693_4095722529035524722_n.jpg', cadeiras: '/assets/fotos/apresentacao/466799909_17957726987838563_7070470414627991170_n.jpg', recepcao: '/assets/fotos/apresentacao/485151397_17972504102838563_5528938866140468801_n.jpg', salao: '/assets/fotos/apresentacao/hestory_5.png', frigobar: '/assets/fotos/apresentacao/hestory_8.png' } as Record<string, string>)[galleryImage.id] : this.getCompanyMediaUrl(GALLERY_MEDIA_SLOTS[galleryImage.id], galleryImage.imageUrl),
    fallbackImageUrl: galleryImage.imageUrl
  })));
  readonly experienceItems: readonly ExperienceItem[] = [
    { title: 'Horário reservado', description: 'Seu atendimento começa no horário combinado.', icon: 'clock' },
    { title: 'Profissionais especializados', description: 'Técnica aplicada ao seu estilo e rotina.', icon: 'award' },
    { title: 'Produtos de qualidade', description: 'Finalização com produtos profissionais.', icon: 'shield' },
    { title: 'Atendimento personalizado', description: 'Cada detalhe e ajustado para você.', icon: 'sparkles' }
  ];
  private carouselInterval: ReturnType<typeof setInterval> | null = null;

  /** Inicia o carrossel automatico e carrega os dados publicos da API. */
  ngOnInit(): void {
    if (this.presentation) {
      this.businessInformation.set({ ...BUSINESS_INFORMATION, name: 'Barbearia Exemplo' });
      this.services.set([
        { id: 'corte', name: 'Corte clássico', description: 'Corte personalizado para o seu estilo.', duration: '40 min', durationMinutes: 40, price: 50, imageUrl: SERVICE_PLACEHOLDER_IMAGE_URL },
        { id: 'barba', name: 'Barba', description: 'Aparar e modelar com cuidado.', duration: '30 min', durationMinutes: 30, price: 35, imageUrl: SERVICE_PLACEHOLDER_IMAGE_URL },
        { id: 'combo', name: 'Corte e barba', description: 'A experiência completa em um atendimento.', duration: '60 min', durationMinutes: 60, price: 75, imageUrl: SERVICE_PLACEHOLDER_IMAGE_URL }
      ]);
      this.subscriptionPlans.set([
        { id: 'mensal', name: 'Plano mensal', description: 'Cuide do visual durante todo o mês.', price: 120, billingPeriod: 'Monthly', isFeatured: true, displayOrder: 1, benefits: [{ serviceId: 'corte', serviceName: 'Cortes', quantityPerPeriod: 2 }] }
      ]);
    } else {
      this.loadCompany();
      this.loadServices();
      this.loadProfessionals();
      this.loadProducts();
      this.loadSubscriptionPlans();
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.startCarousel();
    }
  }

  /** Limpa temporizadores ao sair da pagina. */
  ngOnDestroy(): void {
    this.stopCarousel();
  }

  /** Fecha modais acessiveis quando o usuario pressiona Escape. */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeProductModal();
    this.closeGalleryLightbox();
  }

  /** Avanca o carrossel e pausa a rotacao automatica apos interacao. */
  showNextSlide(): void {
    this.pauseCarouselAfterInteraction();
    this.activeSlideIndex.update((currentIndex) => (currentIndex + 1) % this.heroSlides().length);
  }

  /** Retorna o carrossel e pausa a rotacao automatica apos interacao. */
  showPreviousSlide(): void {
    this.pauseCarouselAfterInteraction();
    this.activeSlideIndex.update((currentIndex) => (currentIndex - 1 + this.heroSlides().length) % this.heroSlides().length);
  }

  /** Seleciona um slide especifico pelos indicadores de paginacao. */
  selectSlide(slideIndex: number): void {
    this.pauseCarouselAfterInteraction();
    this.activeSlideIndex.set(slideIndex);
  }

  /** Abre o modal demonstrativo com informacoes do produto. */
  openProductModal(product: Product): void {
    this.selectedProduct.set(product);
  }

  /** Fecha o modal de produto. */
  closeProductModal(): void {
    this.selectedProduct.set(null);
  }

  /** Abre a imagem selecionada da galeria em lightbox. */
  openGalleryLightbox(galleryImage: GalleryImage): void {
    this.selectedGalleryImage.set(galleryImage);
  }

  /** Fecha o lightbox da galeria. */
  closeGalleryLightbox(): void {
    this.selectedGalleryImage.set(null);
  }

  /** Avanca para a proxima imagem da galeria no lightbox. */
  showNextGalleryImage(): void {
    const selectedImage = this.selectedGalleryImage();

    if (!selectedImage) {
      return;
    }

    const galleryImages = this.galleryImages();
    const currentIndex = galleryImages.findIndex((galleryImage) => galleryImage.id === selectedImage.id);
    this.selectedGalleryImage.set(galleryImages[(currentIndex + 1) % galleryImages.length]);
  }

  /** Retorna para a imagem anterior da galeria no lightbox. */
  showPreviousGalleryImage(): void {
    const selectedImage = this.selectedGalleryImage();

    if (!selectedImage) {
      return;
    }

    const galleryImages = this.galleryImages();
    const currentIndex = galleryImages.findIndex((galleryImage) => galleryImage.id === selectedImage.id);
    this.selectedGalleryImage.set(galleryImages[(currentIndex - 1 + galleryImages.length) % galleryImages.length]);
  }

  /** Destaca um servico para atualizar a imagem editorial lateral. */
  highlightService(serviceIndex: number): void {
    this.highlightedServiceIndex.set(serviceIndex);
  }

  /** Seleciona um profissional para mostrar detalhes no painel editorial. */
  selectProfessionalProfile(professionalIndex: number): void {
    this.selectedProfessionalIndex.set(professionalIndex);
  }

  /** Formata valores em real quando o texto nao usa CurrencyPipe. */
  formatPrice(price: number): string {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Retorna o destino do CTA preservando o plano quando o cliente ainda nao esta autenticado. */
  getSubscriptionPlanRoute(planId: string): string {
    return this.customerSessions.isAccountAuthenticated() ? this.companyContextService.publicUrl(`assinatura/contratar/${planId}`) : this.companyContextService.publicUrl('login');
  }

  /** Preserva a intencao de contratacao para continuar depois do login ou cadastro. */
  getSubscriptionPlanQueryParams(planId: string): Record<string, string> | null {
    return this.customerSessions.isAccountAuthenticated() ? null : { returnUrl: this.companyContextService.publicUrl(`assinatura/contratar/${planId}`) };
  }

  /** Exibe periodicidade publica sem acoplar texto ao enum bruto da API. */
  getBillingPeriodLabel(plan: PublicSubscriptionPlan): string {
    return plan.billingPeriod === 'Monthly' ? 'mês' : plan.billingPeriod;
  }

  /** Formata quantidade e nome do servico em texto curto para o card publico. */
  getBenefitLabel(benefitQuantity: number, serviceName: string): string {
    return `${benefitQuantity} ${serviceName}`;
  }

  /** Carrega a empresa publica e aplica os campos que ja aparecem na landing. */
  private loadCompany(): void {
    this.isLoadingCompany.set(true);
    this.companyErrorMessage.set('');

    this.publicCompanyStateService.getCompany().pipe(
      catchError(() => {
        this.companyErrorMessage.set('Não foi possível carregar os dados da empresa.');
        return of(null);
      }),
      finalize(() => this.isLoadingCompany.set(false))
    ).subscribe((company) => {
      if (!company) {
        return;
      }

      const businessInformation = mapPublicCompanyToBusinessInformation(company);
      this.companyMedia.set(company.media ?? []);
      this.businessInformation.set(businessInformation);
      this.googleMapsEmbedUrl = businessInformation.googleMapsEmbedUrl
        ? this.domSanitizer.bypassSecurityTrustResourceUrl(businessInformation.googleMapsEmbedUrl)
        : null;
    });
  }

  /** Carrega os servicos publicos e atualiza a lista exibida na landing. */
  private loadServices(): void {
    this.isLoadingServices.set(true);
    this.servicesErrorMessage.set('');

    this.publicBookingApiService.getServices(this.companyContextService.companySlug()).pipe(
      catchError(() => {
        this.servicesErrorMessage.set('Não foi possível carregar os serviços.');
        return of<PublicService[]>([]);
      }),
      finalize(() => this.isLoadingServices.set(false))
    ).subscribe((publicServices) => {
      const services = publicServices.map((publicService) => this.mapPublicServiceToBarberService(publicService));
      this.services.set(services);
      this.highlightedServiceIndex.set(0);
    });
  }

  /** Carrega os profissionais publicos e atualiza a equipe exibida na landing. */
  private loadProfessionals(): void {
    this.isLoadingProfessionals.set(true);
    this.professionalsErrorMessage.set('');

    this.publicBookingApiService.getProfessionals(this.companyContextService.companySlug()).pipe(
      catchError(() => {
        this.professionalsErrorMessage.set('Não foi possível carregar os profissionais.');
        return of<PublicProfessional[]>([]);
      }),
      finalize(() => this.isLoadingProfessionals.set(false))
    ).subscribe((publicProfessionals) => {
      const professionals = publicProfessionals.map((publicProfessional) => this.mapPublicProfessionalToProfessional(publicProfessional));
      this.professionals.set(professionals);
      this.selectedProfessionalIndex.set(0);
    });
  }

  /** Carrega os produtos publicos ativos e em estoque exibidos na landing. */
  private loadProducts(): void {
    this.isLoadingProducts.set(true);
    this.productsErrorMessage.set('');

    this.publicProductsApiService.getProducts(this.companyContextService.companySlug()).pipe(
      catchError(() => {
        this.productsErrorMessage.set('Não foi possível carregar os produtos.');
        return of<Product[]>([]);
      }),
      finalize(() => this.isLoadingProducts.set(false))
    ).subscribe((products) => {
      this.products.set(products);
    });
  }

  /** Carrega planos publicos reais disponiveis para contratacao. */
  private loadSubscriptionPlans(): void {
    this.isLoadingSubscriptionPlans.set(true);
    this.subscriptionPlansErrorMessage.set('');

    this.publicSubscriptionsApiService.getSubscriptionPlans(this.companyContextService.companySlug()).pipe(
      catchError(() => {
        this.subscriptionPlansErrorMessage.set('Não foi possível carregar as assinaturas.');
        return of<PublicSubscriptionPlan[]>([]);
      }),
      finalize(() => this.isLoadingSubscriptionPlans.set(false))
    ).subscribe((plans) => {
      this.subscriptionPlans.set(plans);
    });
  }

  /** Converte o DTO de servico publico para o modelo visual atual. */
  private mapPublicServiceToBarberService(publicService: PublicService): BarberService {
    return {
      id: publicService.id,
      name: publicService.name,
      description: publicService.description ?? '',
      duration: `${publicService.durationInMinutes} minutos`,
      durationMinutes: publicService.durationInMinutes,
      price: publicService.price,
      // Foto do proprio servico; sem ela, o placeholder neutro (nunca foto de banco atribuida a barbearia).
      imageUrl: resolveApiMediaUrl(publicService.imageUrl) || SERVICE_PLACEHOLDER_IMAGE_URL
    };
  }

  /** Converte o DTO de profissional publico para o modelo visual atual. */
  private mapPublicProfessionalToProfessional(publicProfessional: PublicProfessional): Professional {
    return {
      id: publicProfessional.id,
      name: publicProfessional.name,
      specialty: 'Profissional',
      description: publicProfessional.biography ?? '',
      yearsOfExperience: publicProfessional.yearsOfExperience,
      photoUrl: publicProfessional.imageUrl,
      socialNetworks: []
    };
  }

  /** Inicia a troca automatica dos slides da hero. */
  private startCarousel(): void {
    this.carouselInterval = setInterval(() => {
      this.activeSlideIndex.update((currentIndex) => (currentIndex + 1) % this.heroSlides().length);
    }, 6200);
  }

  /** Retorna a imagem institucional configurada para o slot ou o fallback atual da Home. */
  private getCompanyMediaUrl(slot: PublicCompanyMediaSlot | undefined, fallbackImageUrl: string): string {
    if (!slot) {
      return fallbackImageUrl;
    }

    return this.companyMedia().find((mediaItem) => mediaItem.slot === slot)?.imageUrl || fallbackImageUrl;
  }

  /** Pausa a rotacao automatica apos interacao manual do usuario. */
  private pauseCarouselAfterInteraction(): void {
    this.stopCarousel();
  }

  /** Interrompe o temporizador do carrossel. */
  private stopCarousel(): void {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }
}
