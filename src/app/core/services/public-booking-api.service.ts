import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { CreateAppointmentWaitlistRequest, CreatedAppointmentWaitlist, CreatePublicAppointmentRequest, PublicAppointmentConfirmation, PublicAvailability, PublicCompany, PublicProfessional, PublicService, PublicServiceProfessional, PublicSubscriptionBenefitCoverage, PublicSubscriptionCoveringProfessionals, PublicUsableRedemption } from '../models/public-booking-api.model';
import { resolveApiAssetUrl } from '../utils/api-asset-url.util';

@Injectable({ providedIn: 'root' })
export class PublicBookingApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = PUBLIC_API_CONFIG.apiBaseUrl;

  /** Busca os dados publicos da empresa pelo slug configurado. */
  getCompany(companySlug: string): Observable<PublicCompany> {
    return this.httpClient.get<PublicCompany>(`${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}`);
  }

  /** Busca os servicos publicos cadastrados para a empresa. */
  getServices(companySlug: string): Observable<PublicService[]> {
    return this.httpClient.get<PublicService[]>(`${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/services`).pipe(
      map((services) => services.map((service) => ({
        ...service,
        imageUrl: resolveApiAssetUrl(service.imageUrl)
      })))
    );
  }

  /** Busca todos os profissionais publicos cadastrados para a empresa. */
  getProfessionals(companySlug: string): Observable<PublicProfessional[]> {
    return this.httpClient.get<PublicProfessional[]>(`${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/professionals`).pipe(
      map((professionals) => professionals.map((professional) => this.mapPublicProfessionalImageUrl(professional)))
    );
  }

  /** Busca os profissionais vinculados ao servico selecionado. */
  getProfessionalsByService(companySlug: string, serviceId: string): Observable<PublicServiceProfessional[]> {
    return this.httpClient.get<PublicServiceProfessional[]>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/services/${encodeURIComponent(serviceId)}/professionals`
    ).pipe(
      map((professionals) => professionals.map((professional) => this.mapPublicProfessionalImageUrl(professional)))
    );
  }

  /** Busca os horarios disponiveis calculados pela API publica. */
  getAvailability(companySlug: string, serviceId: string, date: string, professionalId?: string): Observable<PublicAvailability> {
    let httpParams = new HttpParams()
      .set('serviceId', serviceId)
      .set('date', date);

    if (professionalId) {
      httpParams = httpParams.set('professionalId', professionalId);
    }

    return this.httpClient.get<PublicAvailability>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/availability`,
      { params: httpParams }
    );
  }

  /** Cria um agendamento real usando os IDs e o slot retornados pela API. */
  createAppointment(companySlug: string, appointmentRequest: CreatePublicAppointmentRequest): Observable<PublicAppointmentConfirmation> {
    return this.httpClient.post<PublicAppointmentConfirmation>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/appointments`,
      appointmentRequest
    );
  }

  /** Consulta cobertura de assinatura para servico, profissional e data selecionados. */
  /** Resgates de servico gratis do cliente logado para o servico ("Usar resgate"). */
  getUsableRedemptions(companySlug: string, serviceId: string, replacesAppointmentId: string | null = null): Observable<PublicUsableRedemption[]> {
    let params = new HttpParams().set('serviceId', serviceId);
    if (replacesAppointmentId) {
      params = params.set('replacesAppointmentId', replacesAppointmentId);
    }

    return this.httpClient.get<PublicUsableRedemption[]>(
      `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/loyalty/me/usable-redemptions`,
      { params }
    );
  }

  getSubscriptionCoverage(companySlug: string, serviceId: string, professionalId: string, date: string, replacesAppointmentId: string | null = null): Observable<PublicSubscriptionBenefitCoverage> {
    let httpParams = new HttpParams()
      .set('serviceId', serviceId)
      .set('professionalId', professionalId)
      .set('date', date);
    // Remarcacao: o uso do plano do horario que sai conta como livre para o novo.
    if (replacesAppointmentId) {
      httpParams = httpParams.set('replacesAppointmentId', replacesAppointmentId);
    }

    return this.httpClient.get<PublicSubscriptionBenefitCoverage>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/appointments/subscription-coverage`,
      { params: httpParams }
    );
  }

  /** Quem atende pelo plano do cliente logado no servico (sem sessao: sem plano). */
  getSubscriptionCoveringProfessionals(companySlug: string, serviceId: string): Observable<PublicSubscriptionCoveringProfessionals> {
    return this.httpClient.get<PublicSubscriptionCoveringProfessionals>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/appointments/subscription-coverage/professionals`,
      { params: new HttpParams().set('serviceId', serviceId) }
    );
  }

  /** Cria uma entrada na fila de espera publica. */
  createWaitlistEntry(companySlug: string, waitlistRequest: CreateAppointmentWaitlistRequest): Observable<CreatedAppointmentWaitlist> {
    return this.httpClient.post<CreatedAppointmentWaitlist>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/waitlist`,
      waitlistRequest
    );
  }

  /** Sai da fila com o token de uso unico da entrada (S10). O token vai no corpo, nunca na URL. */
  leaveWaitlist(companySlug: string, cancellationToken: string): Observable<void> {
    return this.httpClient.post<void>(
      `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/waitlist/cancel`,
      { token: cancellationToken }
    );
  }

  /** Resolve a URL da foto publica do profissional para uso direto em imagens. */
  private mapPublicProfessionalImageUrl<TProfessional extends PublicProfessional | PublicServiceProfessional>(professional: TProfessional): TProfessional {
    return {
      ...professional,
      imageUrl: resolveApiAssetUrl(professional.imageUrl)
    };
  }
}
