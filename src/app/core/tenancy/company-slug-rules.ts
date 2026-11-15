import rules from '../../../../shared/company-slug-rules.json';

/**
 * Regras do slug no front, lidas do mesmo shared/company-slug-rules.json que o dominio do backend usa. O front so
 * precisa saber se um segmento da URL pode ser uma empresa: formato e palavras reservadas. Os termos de marca
 * ficam so no backend, que e quem recusa um slug novo.
 */
const COMPANY_SLUG_PATTERN = new RegExp(rules.pattern);

export const RESERVED_COMPANY_SLUGS: ReadonlySet<string> = new Set(Object.values(rules.reserved).flat());

/** Mesma normalizacao do CompanySlug.Normalize do backend: minusculas, sem espacos nas pontas, espaco e sublinhado viram hifen. */
export function normalizeCompanySlug(value: string): string {
  return value.trim().toLowerCase().replace(/[ _]/g, '-');
}

/** Mesmo criterio do CompanySlug.IsWellFormed do backend: formato e tamanho, sem olhar palavras reservadas. */
export function isWellFormedCompanySlug(value: string): boolean {
  return value.length >= rules.minLength && value.length <= rules.maxLength && COMPANY_SLUG_PATTERN.test(value);
}

/** Segmento da URL que pode ser o endereco de uma empresa: bem formado e fora das palavras reservadas. */
export function isCompanySlugSegment(segment: string): boolean {
  return isWellFormedCompanySlug(segment) && !RESERVED_COMPANY_SLUGS.has(segment);
}
