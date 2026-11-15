import { isCompanySlugSegment } from '../tenancy/company-slug-rules';

/** Areas para onde o cliente pode voltar depois do login, direto ou dentro do endereco da empresa (/{slug}/...). */
export const CLIENT_RETURN_AREAS: readonly string[] = ['cliente', 'assinatura/contratar'];
/** Areas do painel; quem decide se o usuario pode entrar nelas e o mapa de areas autorizadas. */
export const ADMIN_RETURN_AREAS: readonly string[] = ['admin', 'painel'];
export const PLATFORM_RETURN_AREAS: readonly string[] = ['platform'];
/** Area global da conta do cliente (Fase 4). */
export const MY_ACCOUNT_RETURN_AREAS: readonly string[] = ['minha-conta'];

export interface ReturnUrlOptions {
  /** Aceita a area tambem depois de um slug de empresa: /{slug}/cliente. */
  readonly allowCompanySlugPrefix: boolean;
  /** Exige que o caminho seja da empresa informada: /{companySlug}/{area}. Area sem slug ou de outra empresa e recusada. */
  readonly companySlug?: string;
}

// Espaco, barra invertida e caracteres de controle: o navegador trata "\" como "/" e "/\evil.com" viraria outro host.
const FORBIDDEN_CHARACTERS = /[\s\\\u0000-\u001f\u007f]/;

/**
 * S6: unico validador de returnUrl do front (cliente, painel e plataforma). Aceita so caminho interno: comeca com
 * uma barra, nunca "//", sem esquema, espaco, barra invertida, caractere de controle ou segmento "." e "..", nem
 * disfarcado com percent-encoding, e cai numa das areas permitidas. Qualquer outra coisa devolve null e quem chama
 * usa o destino padrao.
 */
export function safeReturnUrl(value: string | null | undefined, areas: readonly string[], options: ReturnUrlOptions): string | null {
  const decoded = value ? decodeOrNull(value) : null;
  if (!value || decoded === null || !isInternalPath(value) || !isInternalPath(decoded)) {
    return null;
  }

  // Area e segmentos conferidos no caminho ja decodificado: "%2e%2e" e ".." para o navegador.
  const path = decoded.split(/[?#]/)[0];
  const segments = path.split('/').slice(1);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  const [firstSegment, ...rest] = segments;
  if (options.companySlug !== undefined) {
    return firstSegment === options.companySlug && isInArea(`/${rest.join('/')}`, areas) ? value : null;
  }

  if (isInArea(path, areas)) {
    return value;
  }

  return options.allowCompanySlugPrefix && isCompanySlugSegment(firstSegment) && isInArea(`/${rest.join('/')}`, areas) ? value : null;
}

/**
 * Destino do cliente depois de entrar ou se cadastrar na empresa: o returnUrl, se for da area do cliente ou da
 * contratacao de plano DESSA empresa; senao, a area do cliente dela.
 */
export function customerReturnUrl(returnUrl: string | null | undefined, companySlug: string): string {
  return safeReturnUrl(returnUrl, CLIENT_RETURN_AREAS, { allowCompanySlugPrefix: true, companySlug }) ?? `/${companySlug}/cliente`;
}

/**
 * Destino do cliente que entra pela raiz (/entrar): o returnUrl, se for da /minha-conta, da vitrine (/) ou do perfil de
 * uma empresa (/{slug}, de onde o coracao do favorito manda entrar, Fase 6); senao, a /minha-conta.
 */
export function accountReturnUrl(returnUrl: string | null | undefined): string {
  return safeReturnUrl(returnUrl, MY_ACCOUNT_RETURN_AREAS, { allowCompanySlugPrefix: false }) ?? publicPageReturnUrl(returnUrl) ?? '/minha-conta';
}

/**
 * O Inicio (/), o Buscar (/buscar) ou o perfil (/{slug}): caminho interno, so esses formatos, com ou sem query. O valor cru passa pela
 * regra do caminho interno; o decodificado so no caminho (a busca da vitrine tem espaco na query: cidade=Campo%20Grande).
 */
function publicPageReturnUrl(value: string | null | undefined): string | null {
  const decoded = value ? decodeOrNull(value) : null;
  const path = decoded?.split(/[?#]/)[0] ?? '';
  if (!value || decoded === null || !isInternalPath(value) || !isInternalPath(path)) {
    return null;
  }

  if (path === '/' || path === '/buscar') {
    return value;
  }

  const segments = path.split('/').slice(1);
  return segments.length === 1 && isCompanySlugSegment(segments[0]) ? value : null;
}

function decodeOrNull(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    // Percent-encoding quebrado nao e um caminho que o proprio sistema gerou.
    return null;
  }
}

function isInternalPath(candidate: string): boolean {
  return candidate.startsWith('/') && !candidate.startsWith('//') && !FORBIDDEN_CHARACTERS.test(candidate);
}

function isInArea(path: string, areas: readonly string[]): boolean {
  return areas.some((area) => path === `/${area}` || path.startsWith(`/${area}/`));
}
