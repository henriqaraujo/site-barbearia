import { Injectable, signal } from '@angular/core';
import { CompanySegment, DEFAULT_SEGMENT_TERMS, SegmentTerms, parseCompanySegment } from '../models/company-segment.model';

/**
 * Ramo e termos da empresa atual. Fica separado do CompanyContextService de proposito: so guarda signals (sem HttpClient),
 * entao qualquer tela ou pipe le os termos sem puxar o contexto inteiro. Quem carrega a empresa (identity, empresa
 * publica, Configuracoes, sugestoes) grava aqui pelo CompanyContextService.applySegmentInfo.
 */
@Injectable({ providedIn: 'root' })
export class SegmentStateService {
  private readonly segmentValue = signal<CompanySegment | null>(null);
  private readonly termsValue = signal<SegmentTerms>(DEFAULT_SEGMENT_TERMS);
  private readonly suggestionsDismissedAtValue = signal<string | null>(null);

  /** Ramo da empresa (null = ainda nao escolhido). */
  readonly segment = this.segmentValue.asReadonly();
  /** Termos dos textos de tela (padrao: cliente/servico). */
  readonly terms = this.termsValue.asReadonly();
  /** Quando o dono viu ou pulou as sugestoes do ramo (null = ainda nao); so vem no painel. */
  readonly suggestionsDismissedAt = this.suggestionsDismissedAtValue.asReadonly();

  /** Aplica o que a API devolveu; sem `terms` na resposta mantem os atuais (exceto ramo vazio, que volta ao padrao). */
  apply(segment: string | null | undefined, terms?: SegmentTerms | null, suggestionsDismissedAt?: string | null): void {
    this.segmentValue.set(parseCompanySegment(segment));
    if (terms?.customer && terms.customers && terms.service && terms.services) {
      this.termsValue.set(terms);
    } else if (segment === null) {
      this.termsValue.set(DEFAULT_SEGMENT_TERMS);
    }

    if (suggestionsDismissedAt !== undefined) {
      this.suggestionsDismissedAtValue.set(suggestionsDismissedAt);
    }
  }
}
