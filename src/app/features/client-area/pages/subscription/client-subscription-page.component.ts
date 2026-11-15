import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { ClientSubscriptionComponent } from './client-subscription.component';

/** Rota /{slug}/cliente/meu-plano: o plano na empresa da URL. */
@Component({
  selector: 'app-client-subscription-page',
  standalone: true,
  imports: [ClientSubscriptionComponent],
  template: '<app-client-subscription [companySlug]="companySlug()" [companyName]="companyName()" />',
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientSubscriptionPageComponent {
  private readonly companyContextService = inject(CompanyContextService);

  readonly companySlug = this.companyContextService.companySlug;
  readonly companyName = this.companyContextService.fullName;
}
