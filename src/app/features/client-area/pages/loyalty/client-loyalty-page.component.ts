import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { ClientLoyaltyComponent } from './client-loyalty.component';

/** Rota /{slug}/cliente/fidelidade: "Meus pontos" da empresa da URL. */
@Component({
  selector: 'app-client-loyalty-page',
  standalone: true,
  imports: [ClientLoyaltyComponent],
  template: '<app-client-loyalty [companySlug]="companySlug()" />',
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientLoyaltyPageComponent {
  private readonly companyContextService = inject(CompanyContextService);

  readonly companySlug = this.companyContextService.companySlug;
}
