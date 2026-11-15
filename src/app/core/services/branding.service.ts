import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { PLATFORM_BRAND } from '../constants/platform-brand.constants';
import { readableTextColor } from '../utils/color-contrast';

/** Cores de empresa sem cor valida: as mesmas do TenantDefaults do backend. */
export const DEFAULT_BRAND_COLORS = {
  primary: '#1f2933',
  secondary: '#f4f6f8',
  accent: '#c6922c'
} as const;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Cor #rrggbb valida ou a reserva: a API ja valida, e o front confere de novo antes de a cor chegar ao CSS. */
export function brandColorOrDefault(color: string | null | undefined, fallbackColor: string): string {
  return color && HEX_COLOR_PATTERN.test(color) ? color : fallbackColor;
}

/** O que a pagina precisa para mostrar a marca de uma empresa. */
export interface BrandIdentity {
  /** Nome completo (D5): titulo da aba. O nome curto fica para os espacos pequenos. */
  readonly name: string;
  readonly logoUrl: string;
  readonly faviconUrl: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
}

/**
 * Unico lugar que aplica a marca da empresa na pagina: variaveis CSS das cores (e do texto sobre elas), favicon e
 * titulo da aba. O painel admin usa sempre a paleta fixa --admin-*, igual em todas as empresas; as cores daqui valem
 * para o site publico e a area do cliente.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly document = inject(DOCUMENT);

  apply(identity: BrandIdentity): void {
    this.applyCssVariables(identity);
    this.applyFavicon(identity.faviconUrl || identity.logoUrl);
    // Sem nome (empresa ainda carregando), fica o titulo que ja esta na aba: nunca um nome provisorio.
    if (identity.name) {
      this.document.title = identity.name;
    }
  }

  /**
   * So as tres cores da empresa e o texto legivel sobre cada uma; o resto da paleta do site deriva delas no CSS
   * (styles.scss). O texto e calculado aqui porque o CSS ainda nao escolhe cor por contraste.
   */
  private applyCssVariables(identity: BrandIdentity): void {
    const root = this.document.documentElement;
    const colors = {
      primary: brandColorOrDefault(identity.primaryColor, DEFAULT_BRAND_COLORS.primary),
      secondary: brandColorOrDefault(identity.secondaryColor, DEFAULT_BRAND_COLORS.secondary),
      accent: brandColorOrDefault(identity.accentColor, DEFAULT_BRAND_COLORS.accent)
    };

    for (const [role, color] of Object.entries(colors)) {
      root.style.setProperty(`--company-${role}-color`, color);
      root.style.setProperty(`--brand-on-${role}`, readableTextColor(color).color);
    }
  }

  private applyFavicon(faviconUrl: string): void {
    // Sem favicon nem logo da barbearia, o icone neutro da plataforma; nunca a marca de outra empresa.
    const iconUrl = faviconUrl || PLATFORM_BRAND.faviconUrl;
    let favicon = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!favicon) {
      favicon = this.document.createElement('link');
      favicon.rel = 'icon';
      this.document.head.appendChild(favicon);
    }

    // Sem tipo fixo: o icone pode ser PNG, SVG ou ICO, e um type errado faz o navegador ignorar o icone.
    favicon.removeAttribute('type');
    favicon.href = iconUrl;
  }
}
