import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { SegmentTerms } from '../models/company-segment.model';
import { SegmentStateService } from './segment-state.service';
import { PublicCompany, PublicCompanyMedia, PublicCompanyMediaSlot } from '../models/public-booking-api.model';
import { TenantContextStore } from '../tenancy/tenant-context.store';
import { resolveApiMediaUrl } from '../utils/api-media-url.util';
import { BrandingService, DEFAULT_BRAND_COLORS, brandColorOrDefault } from './branding.service';
import { companyMapsUrl, companyWhatsappUrl } from '../utils/company-contact-links';

export interface CompanyIdentity {
  readonly id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly displayName: string;
  readonly logoUrl: string;
  readonly faviconUrl: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
}

interface AdminCompanySettingsResponse {
  readonly business: {
    readonly name: string;
    readonly displayShortName: string;
    readonly slug: string;
  };
  /** Ramo e termos (paciente/procedimento na clinica); ausentes em respostas antigas. */
  readonly segment?: string | null;
  readonly terms?: SegmentTerms | null;
  readonly suggestionsDismissedAt?: string | null;
  readonly branding: {
    readonly primaryColor: string;
    readonly secondaryColor: string;
    readonly accentColor: string;
    readonly logoPreviewUrl: string;
    readonly faviconUrl?: string;
    readonly media?: readonly PublicCompanyMedia[];
  };
}

@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private readonly httpClient = inject(HttpClient);
  private readonly brandingService = inject(BrandingService);
  private readonly tenantContextStore = inject(TenantContextStore);
  private readonly apiBaseUrl = PUBLIC_API_CONFIG.apiBaseUrl;
  private publicCompanyRequest$: Observable<PublicCompany> | null = null;
  private publicCompanyRequestSlug = '';
  private readonly companyValue = signal<CompanyIdentity>(this.createFallbackIdentity(''));
  private readonly publicCompanyValue = signal<PublicCompany | null>(null);
  private readonly segmentState = inject(SegmentStateService);

  readonly company = this.companyValue.asReadonly();
  readonly publicCompany = this.publicCompanyValue.asReadonly();
  /** Ramo da empresa (null = ainda nao escolhido) e os termos que ele define nos textos de tela. */
  readonly segment = this.segmentState.segment;
  readonly terms = this.segmentState.terms;
  /** Quando o dono viu ou pulou as sugestoes do ramo (null = ainda nao); so vem no painel. */
  readonly suggestionsDismissedAt = this.segmentState.suggestionsDismissedAt;
  /** Slug da empresa da URL (TenantContextStore); vazio fora de /{slug}. Nao ha empresa padrao do build. */
  readonly companySlug = computed(() => this.tenantContextStore.slug() ?? '');
  /** Nome curto (D5), para espacos pequenos; o fallback para o nome completo ja vem resolvido da API. */
  readonly name = computed(() => this.companyValue().displayName || this.companyValue().name);
  /** Nome completo (D5): titulo da aba, cabecalho do site e title da marca na sidebar. */
  readonly fullName = computed(() => this.companyValue().name);
  readonly logoUrl = computed(() => this.companyValue().logoUrl);
  /** Contato da barbearia carregada, para os botoes "WhatsApp" e "Como chegar"; null sem numero ou endereco. */
  readonly whatsappUrl = computed(() => companyWhatsappUrl(this.publicCompanyValue()));
  readonly mapsUrl = computed(() => companyMapsUrl(this.publicCompanyValue()));

  /** Carrega a empresa publica pelo slug informado (o da URL, via tenantGuard) e aplica a identidade visual global. */
  loadPublicCompany(companySlug: string): Observable<PublicCompany> {
    if (this.publicCompanyRequest$ && this.publicCompanyRequestSlug === companySlug) {
      return this.publicCompanyRequest$;
    }

    this.publicCompanyRequestSlug = companySlug;
    this.publicCompanyRequest$ = this.httpClient
      .get<PublicCompany>(`${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}`)
      .pipe(
        map((company) => this.resolvePublicCompanyMediaUrls(company)),
        tap((company) => {
          this.publicCompanyValue.set(company);
          this.applySegmentInfo(company.segment, company.terms);
          this.applyIdentity(this.mapPublicCompanyToIdentity(company));
        }),
        catchError((error: unknown) => {
          this.applyIdentity(this.createFallbackIdentity(companySlug));
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    return this.publicCompanyRequest$;
  }

  /**
   * Carrega a identidade administrativa a partir do tenant autenticado no JWT. Usa a rota de identidade, aberta a
   * qualquer usuario do painel: a de Configuracoes respondia 403 em toda tela para quem nao tem essa permissao (M10).
   */
  loadAdminCompany(): Observable<CompanyIdentity> {
    return this.httpClient.get<AdminCompanySettingsResponse>(`${this.apiBaseUrl}/api/admin/settings/identity`).pipe(
      tap((settings) => this.applySegmentInfo(settings.segment ?? null, settings.terms, settings.suggestionsDismissedAt ?? null)),
      map((settings) => this.mapAdminSettingsToIdentity(settings)),
      tap((identity) => this.applyIdentity(identity))
    );
  }

  /** Ramo e termos vindos da API (identity, empresa publica, Configuracoes); sem terms na resposta, mantem os atuais. */
  applySegmentInfo(segment: string | null | undefined, terms?: SegmentTerms | null, suggestionsDismissedAt?: string | null): void {
    this.segmentState.apply(segment, terms, suggestionsDismissedAt);
  }

  /** Atualiza o contexto depois que settings administrativos retornam do backend. */
  applyAdminSettings(settings: AdminCompanySettingsResponse): CompanyIdentity {
    if (settings.segment !== undefined || settings.terms) {
      this.applySegmentInfo(settings.segment, settings.terms, settings.suggestionsDismissedAt);
    }

    const identity = this.mapAdminSettingsToIdentity(settings);
    this.applyIdentity(identity);
    return identity;
  }

  /** Atualiza logo/favicon no contexto apos upload administrativo sem recarregar a tela. */
  applyBrandingMedia(media: PublicCompanyMedia): CompanyIdentity {
    const currentIdentity = this.companyValue();
    const imageUrl = this.resolveImageUrl(media.imageUrl || media.fallbackImageUrl);

    if (media.slot !== 'LogoPrimary' && media.slot !== 'Favicon') {
      return currentIdentity;
    }

    const identity: CompanyIdentity = {
      ...currentIdentity,
      logoUrl: media.slot === 'LogoPrimary' ? imageUrl : currentIdentity.logoUrl,
      faviconUrl: media.slot === 'Favicon' ? imageUrl : currentIdentity.faviconUrl
    };

    this.applyIdentity(identity);
    return identity;
  }

  /** Caminho dentro do endereco da empresa atual: publicUrl('agendamento') => /{slug}/agendamento. */
  publicUrl(path = ''): string {
    const slug = this.companySlug();
    const basePath = slug ? `/${slug}` : '';
    const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';

    return `${basePath}${normalizedPath}` || '/';
  }

  private applyIdentity(identity: CompanyIdentity): void {
    this.companyValue.set(identity);
    this.brandingService.apply(identity);
  }

  private mapPublicCompanyToIdentity(company: PublicCompany): CompanyIdentity {
    const logoUrl = this.resolveImageUrl(this.findMediaUrl(company.media, 'LogoPrimary') || company.branding.logoPreviewUrl);

    return {
      id: company.id,
      name: company.name,
      slug: company.canonicalSlug,
      displayName: company.displayShortName,
      logoUrl,
      faviconUrl: this.resolveImageUrl(this.findMediaUrl(company.media, 'Favicon') || company.branding.faviconUrl || logoUrl),
      primaryColor: brandColorOrDefault(company.branding.primaryColor, DEFAULT_BRAND_COLORS.primary),
      secondaryColor: brandColorOrDefault(company.branding.secondaryColor, DEFAULT_BRAND_COLORS.secondary),
      accentColor: brandColorOrDefault(company.branding.accentColor, DEFAULT_BRAND_COLORS.accent)
    };
  }

  private mapAdminSettingsToIdentity(settings: AdminCompanySettingsResponse): CompanyIdentity {
    const logoUrl = this.resolveImageUrl(this.findMediaUrl(settings.branding.media ?? [], 'LogoPrimary') || settings.branding.logoPreviewUrl);

    return {
      id: null,
      name: settings.business.name,
      slug: settings.business.slug,
      displayName: settings.business.displayShortName,
      logoUrl,
      faviconUrl: this.resolveImageUrl(this.findMediaUrl(settings.branding.media ?? [], 'Favicon') || settings.branding.faviconUrl || logoUrl),
      primaryColor: brandColorOrDefault(settings.branding.primaryColor, DEFAULT_BRAND_COLORS.primary),
      secondaryColor: brandColorOrDefault(settings.branding.secondaryColor, DEFAULT_BRAND_COLORS.secondary),
      accentColor: brandColorOrDefault(settings.branding.accentColor, DEFAULT_BRAND_COLORS.accent)
    };
  }

  private resolvePublicCompanyMediaUrls(company: PublicCompany): PublicCompany {
    return {
      ...company,
      branding: {
        ...company.branding,
        logoPreviewUrl: this.resolveImageUrl(company.branding.logoPreviewUrl),
        coverPreviewUrl: this.resolveImageUrl(company.branding.coverPreviewUrl),
        faviconUrl: this.resolveImageUrl(company.branding.faviconUrl)
      },
      media: (company.media ?? []).map((media) => ({
        ...media,
        imageUrl: this.resolveImageUrl(media.imageUrl),
        fallbackImageUrl: this.resolveImageUrl(media.fallbackImageUrl)
      }))
    };
  }

  private findMediaUrl(media: readonly PublicCompanyMedia[], slot: PublicCompanyMediaSlot): string {
    return media.find((mediaItem) => mediaItem.slot === slot)?.imageUrl ?? '';
  }

  private resolveImageUrl(imageUrl: string | null | undefined): string {
    return resolveApiMediaUrl(imageUrl) || '';
  }

  private createFallbackIdentity(companySlug: string): CompanyIdentity {
    // Sem nome provisorio (nem "Empresa", nem adivinhado do slug): enquanto nao carrega, a marca mostra esqueleto.
    return {
      id: null,
      name: '',
      slug: companySlug,
      displayName: '',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: DEFAULT_BRAND_COLORS.primary,
      secondaryColor: DEFAULT_BRAND_COLORS.secondary,
      accentColor: DEFAULT_BRAND_COLORS.accent
    };
  }
}
