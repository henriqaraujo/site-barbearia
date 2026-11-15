import { Pipe, PipeTransform, inject } from '@angular/core';
import { CompanyContextService } from '../services/company-context.service';

/**
 * Caminho dentro do endereco da empresa atual, para templates: 'agendamento' | tenantUrl => /{slug}/agendamento.
 * Impuro de proposito: trocar de empresa reaproveita o componente, e o caminho precisa acompanhar o slug.
 */
@Pipe({ name: 'tenantUrl', standalone: true, pure: false })
export class TenantUrlPipe implements PipeTransform {
  private readonly companyContextService = inject(CompanyContextService);

  transform(path = ''): string {
    return this.companyContextService.publicUrl(path);
  }
}
