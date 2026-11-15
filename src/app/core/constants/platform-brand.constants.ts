import { UI_TERMS } from './ui-terms';
/** Marca da plataforma, nas telas que nao pertencem a nenhuma barbearia (raiz do site, area da plataforma). */
export const PLATFORM_BRAND = {
  name: 'HL Gestão',
  tagline: `Gestão e agendamento para ${UI_TERMS.companies}.`,
  /** Logo completa (desenho e nome), em tamanho de tela; gerada da logo original da HL Gestao (fora do repositorio). */
  logoUrl: '/assets/marca/hl-gestao-logo.png',
  /** So o desenho, quadrado: espacos pequenos (menu lateral) e exemplo no primeiro acesso. */
  iconUrl: '/assets/marca/hl-gestao-icone.png',
  /** Icone da aba: da raiz e de toda empresa que ainda nao enviou logo nem favicon. */
  faviconUrl: '/assets/marca/hl-gestao-icone-32.png'
} as const;
