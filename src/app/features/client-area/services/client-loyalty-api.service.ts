import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { ClientLoyalty, ClientLoyaltyRedemption, ClientLoyaltySummary } from '../models/client-loyalty.model';

/**
 * "Meus pontos" do cliente logado (Fase 5). Quem chama diz a empresa (slug): a area do cliente passa a da URL e a
 * /minha-conta a escolhida no topo. Guarda o resumo (programa ligado e saldo) para o menu e o Inicio da area do
 * cliente, e o atualiza a cada leitura, pedido ou cancelamento.
 */
@Injectable({ providedIn: 'root' })
export class ClientLoyaltyApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly summaryValue = signal<{ slug: string; summary: ClientLoyaltySummary } | null>(null);

  /** Resumo da empresa da area do cliente aberta (o de outra empresa, lido antes de trocar, nao aparece aqui). */
  readonly summary = computed<ClientLoyaltySummary | null>(() => {
    const value = this.summaryValue();
    return value && value.slug === this.companyContextService.companySlug() ? value.summary : null;
  });

  getLoyalty(companySlug: string, page = 1, pageSize = 20): Observable<ClientLoyalty> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.httpClient.get<ClientLoyalty>(loyaltyUrl(companySlug), { params }).pipe(
      tap((loyalty) => this.summaryValue.set({ slug: companySlug, summary: { programEnabled: loyalty.programEnabled, balance: loyalty.balance } }))
    );
  }

  /** Resumo para o menu e o Inicio; falha silenciosa (o menu so nao mostra "Meus pontos"). */
  loadSummary(companySlug: string): void {
    this.getLoyalty(companySlug, 1, 1).subscribe({ error: () => this.summaryValue.set(null) });
  }

  redeem(companySlug: string, rewardId: string): Observable<ClientLoyaltyRedemption> {
    return this.httpClient.post<ClientLoyaltyRedemption>(`${loyaltyUrl(companySlug)}/redemptions`, { rewardId });
  }

  cancelRedemption(companySlug: string, redemptionId: string): Observable<ClientLoyaltyRedemption> {
    return this.httpClient.delete<ClientLoyaltyRedemption>(`${loyaltyUrl(companySlug)}/redemptions/${encodeURIComponent(redemptionId)}`);
  }
}

function loyaltyUrl(companySlug: string): string {
  return `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/loyalty/me`;
}
