import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { catchError, filter, finalize, map, of } from 'rxjs';
import { BUSINESS_INFORMATION } from '../../core/constants/business.constants';
import { BusinessInformation } from '../../core/models/business-information.model';
import { PublicService } from '../../core/models/public-booking-api.model';
import { PublicCompanyStateService } from '../../core/services/public-company-state.service';
import { PublicBookingApiService } from '../../core/services/public-booking-api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { isCompanyProfileUrl } from '../../core/utils/company-profile-url';
import { mapPublicCompanyToBusinessInformation } from '../../core/utils/public-company-business-information.mapper';
import { LegalLinksComponent } from '../../shared/components/legal-links/legal-links.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {
  readonly businessInformation = signal<BusinessInformation>(BUSINESS_INFORMATION);
  /** Descricao que a propria barbearia cadastrou nas configuracoes; sem ela, o rodape nao inventa um texto. */
  readonly companyDescription = signal('');
  readonly services = signal<readonly PublicService[]>([]);
  readonly isLoadingServices = signal(false);
  readonly servicesErrorMessage = signal('');
  readonly currentYear = new Date().getFullYear();
  /** No perfil /{slug} o horario fica so na lateral do perfil. */
  readonly isProfilePage = computed(() => isCompanyProfileUrl(this.currentUrl(), this.companyContextService.publicUrl()));
  private readonly publicCompanyStateService = inject(PublicCompanyStateService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(this.router.events.pipe(filter((event) => event instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  private readonly publicBookingApiService = inject(PublicBookingApiService);
  private readonly companyContextService = inject(CompanyContextService);

  constructor() {
    this.loadCompany();
    this.loadServices();
  }

  /** Carrega a empresa publica e aplica os campos exibidos no rodape. */
  private loadCompany(): void {
    this.publicCompanyStateService.getCompany().pipe(
      catchError(() => of(null))
    ).subscribe((company) => {
      if (!company) {
        return;
      }

      this.businessInformation.set(mapPublicCompanyToBusinessInformation(company));
      this.companyDescription.set(company.description.trim());
    });
  }

  /** Carrega os primeiros servicos publicos exibidos no rodape. */
  private loadServices(): void {
    this.isLoadingServices.set(true);
    this.servicesErrorMessage.set('');

    this.publicBookingApiService.getServices(this.companyContextService.companySlug()).pipe(
      catchError(() => {
        this.servicesErrorMessage.set('Serviços indisponíveis no momento.');
        return of<PublicService[]>([]);
      }),
      finalize(() => this.isLoadingServices.set(false))
    ).subscribe((services) => {
      this.services.set(services.slice(0, 4));
    });
  }

  /** Preserva o slug publico atual nos links do rodape. */
  publicUrl(path = ''): string {
    return this.companyContextService.publicUrl(path);
  }
}
