import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { PublicSubscriptionPlan } from '../../../core/models/public-subscription.model';
import { ClientSubscriptionDetails } from '../models/client-subscription.model';

/** Plano do cliente logado numa empresa. Quem chama diz a empresa (slug): a da URL ou a escolhida na /minha-conta. */
@Injectable({ providedIn: 'root' })
export class ClientSubscriptionApiService {
  private readonly httpClient = inject(HttpClient);

  /** Busca a assinatura atual do cliente autenticado na empresa. */
  /** includeEnded: sem plano em andamento, traz o ultimo expirado (so a tela Meu plano pede, B8). */
  getCurrentSubscription(companySlug: string, includeEnded = false): Observable<ClientSubscriptionDetails | null> {
    return this.httpClient.get<ClientSubscriptionDetails | null>(`${subscriptionPlansUrl(companySlug)}/me`, includeEnded ? { params: { includeEnded: true } } : {});
  }

  /** Busca planos reais ativos e publicos disponiveis da empresa. */
  getAvailablePlans(companySlug: string): Observable<PublicSubscriptionPlan[]> {
    return this.httpClient.get<PublicSubscriptionPlan[]>(subscriptionPlansUrl(companySlug));
  }
}

function subscriptionPlansUrl(companySlug: string): string {
  return `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/subscription-plans`;
}
