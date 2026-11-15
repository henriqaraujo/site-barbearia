import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { PublicCustomerSubscription, PublicSubscriptionPlan, PublicSubscriptionPlanOverlap } from '../models/public-subscription.model';

@Injectable({ providedIn: 'root' })
export class PublicSubscriptionsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = PUBLIC_API_CONFIG.apiBaseUrl;

  /** Busca planos reais ativos e disponiveis para contratacao no site publico. */
  getSubscriptionPlans(companySlug: string): Observable<PublicSubscriptionPlan[]> {
    return this.httpClient.get<PublicSubscriptionPlan[]>(`${this.createSubscriptionPlansUrl(companySlug)}`);
  }

  /** Busca um plano real contratavel para a tela de confirmacao. */
  getSubscriptionPlan(companySlug: string, planId: string): Observable<PublicSubscriptionPlan> {
    return this.httpClient.get<PublicSubscriptionPlan>(`${this.createSubscriptionPlansUrl(companySlug)}/${encodeURIComponent(planId)}`);
  }

  /** Planos que o cliente logado ja tem e que cobrem servicos deste plano (aviso no checkout). */
  getPlanOverlap(companySlug: string, planId: string): Observable<PublicSubscriptionPlanOverlap[]> {
    return this.httpClient.get<PublicSubscriptionPlanOverlap[]>(`${this.createSubscriptionPlansUrl(companySlug)}/${encodeURIComponent(planId)}/overlap`);
  }

  /** Cria solicitacao de assinatura para o cliente autenticado atual. */
  /** `phone` so vai quando a conta nao tem celular e ainda nao tem vinculo na empresa (o vinculo novo precisa dele). */
  subscribe(companySlug: string, planId: string, phone: string | null = null): Observable<PublicCustomerSubscription> {
    return this.httpClient.post<PublicCustomerSubscription>(`${this.createSubscriptionPlansUrl(companySlug)}/${encodeURIComponent(planId)}/subscribe`, phone ? { phone } : {});
  }

  private createSubscriptionPlansUrl(companySlug: string): string {
    return `${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/subscription-plans`;
  }
}
