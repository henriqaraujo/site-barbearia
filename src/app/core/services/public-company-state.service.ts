import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PublicCompany } from '../models/public-booking-api.model';
import { CompanyContextService } from './company-context.service';

@Injectable({ providedIn: 'root' })
export class PublicCompanyStateService {
  private readonly companyContextService = inject(CompanyContextService);

  /** Compartilha os dados publicos da empresa entre componentes da area publica. */
  getCompany(): Observable<PublicCompany> {
    return this.companyContextService.loadPublicCompany(this.companyContextService.companySlug());
  }
}
