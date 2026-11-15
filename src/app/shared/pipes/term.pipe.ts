import { Pipe, PipeTransform, inject } from '@angular/core';
import { SegmentTermsService } from '../../core/services/segment-terms.service';

/**
 * `{{ 'Novo cliente' | term }}`: troca cliente/servico pelos termos do ramo da empresa (paciente/procedimento na clinica).
 * Impuro de proposito: le o signal dos termos, que muda quando o ramo carrega ou e trocado.
 */
@Pipe({ name: 'term', standalone: true, pure: false })
export class TermPipe implements PipeTransform {
  private readonly segmentTerms = inject(SegmentTermsService);

  transform(text: string | null | undefined): string {
    return this.segmentTerms.localize(text ?? '');
  }
}
