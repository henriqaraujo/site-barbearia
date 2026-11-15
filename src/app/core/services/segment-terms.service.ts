import { Injectable, computed, inject } from '@angular/core';
import { localizeTerms } from '../models/company-segment.model';
import { SegmentStateService } from './segment-state.service';

/**
 * Termos do ramo da empresa atual (paciente/procedimento na clinica odontologica, cliente/servico nos demais),
 * lidos do contexto da empresa: `identity` no painel e a empresa publica no site.
 */
@Injectable({ providedIn: 'root' })
export class SegmentTermsService {
  private readonly state = inject(SegmentStateService);

  /** Sem a empresa carregada valem os termos padrao (cliente/servico). */
  readonly terms = this.state.terms;
  readonly customer = computed(() => this.terms().customer);
  readonly customers = computed(() => this.terms().customers);
  readonly service = computed(() => this.terms().service);
  readonly services = computed(() => this.terms().services);
  readonly Customer = computed(() => capitalize(this.terms().customer));
  readonly Customers = computed(() => capitalize(this.terms().customers));
  readonly Service = computed(() => capitalize(this.terms().service));
  readonly Services = computed(() => capitalize(this.terms().services));

  /** Texto de tela com cliente/servico trocados pelos termos do ramo. */
  localize(text: string): string {
    return localizeTerms(text, this.terms());
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
