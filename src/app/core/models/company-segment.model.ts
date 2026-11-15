import segmentLabels from './company-segment-labels.json';

/** Ramo da empresa, como a API devolve (companies.segment); null = ainda nao escolhido. */
export type CompanySegment = 'Barbershop' | 'BeautySalon' | 'Aesthetics' | 'DentalClinic' | 'Other';

export interface CompanySegmentOption {
  readonly id: CompanySegment;
  readonly label: string;
}

/**
 * Opcoes da escolha do ramo, na ordem da tela. "Other" e o "prefiro cadastrar do zero". Os nomes dos ramos ficam no JSON ao
 * lado: a escolha do ramo e o unico lugar em que o nome do segmento aparece escrito (a convencao UiTermsTests nao deixa
 * esse nome em texto de tela).
 */
export const COMPANY_SEGMENT_OPTIONS: readonly CompanySegmentOption[] = (['Barbershop', 'BeautySalon', 'Aesthetics', 'DentalClinic', 'Other'] as const)
  .map((id) => ({ id, label: segmentLabels[id] }));

/** Termos do negocio que mudam por ramo (a API devolve em terms; o padrao e o de todos os ramos menos a clinica). */
export interface SegmentTerms {
  readonly customer: string;
  readonly customers: string;
  readonly service: string;
  readonly services: string;
}

export const DEFAULT_SEGMENT_TERMS: SegmentTerms = {
  customer: 'cliente',
  customers: 'clientes',
  service: 'serviço',
  services: 'serviços'
};

/** Valor desconhecido (API mais nova que o front) vira null em vez de quebrar a tela. */
export function parseCompanySegment(value: unknown): CompanySegment | null {
  return COMPANY_SEGMENT_OPTIONS.some((option) => option.id === value) ? (value as CompanySegment) : null;
}

/** Ramo → texto da lista ("Clínica odontológica"); vazio para null. */
export function companySegmentLabel(segment: CompanySegment | null | undefined): string {
  return COMPANY_SEGMENT_OPTIONS.find((option) => option.id === segment)?.label ?? '';
}

const TERM_WORD = /\b(clientes?|servi[çc]os?)\b/gi;

/**
 * Troca "cliente(s)" e "serviço(s)" de um texto de tela pelos termos do ramo, mantendo maiuscula inicial ou caixa alta.
 * Os dois pares sao masculinos nos termos atuais (paciente/procedimento), entao artigos e adjetivos seguem iguais.
 * Nos termos padrao devolve o texto como veio.
 */
export function localizeTerms(text: string, terms: SegmentTerms): string {
  if (!text || (terms.customer === DEFAULT_SEGMENT_TERMS.customer && terms.service === DEFAULT_SEGMENT_TERMS.service
      && terms.customers === DEFAULT_SEGMENT_TERMS.customers && terms.services === DEFAULT_SEGMENT_TERMS.services)) {
    return text;
  }

  return text.replace(TERM_WORD, (match) => {
    const lower = match.toLowerCase();
    const plural = lower.endsWith('s');
    const isCustomer = lower.startsWith('cli');
    const replacement = isCustomer ? (plural ? terms.customers : terms.customer) : (plural ? terms.services : terms.service);
    if (match.length > 1 && match === match.toUpperCase()) {
      return replacement.toUpperCase();
    }

    return match[0] === match[0].toUpperCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
  });
}
