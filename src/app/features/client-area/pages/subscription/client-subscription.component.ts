import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription, forkJoin, finalize } from 'rxjs';
import { PublicSubscriptionBillingPeriod, PublicSubscriptionPlan } from '../../../../core/models/public-subscription.model';
import {
  ClientSubscriptionBenefit,
  ClientSubscriptionBillingPeriod,
  ClientSubscriptionDetails,
  ClientSubscriptionStatus
} from '../../models/client-subscription.model';
import { ClientSubscriptionApiService } from '../../services/client-subscription-api.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { describePlanProfessionals } from '../../../../core/utils/plan-professionals.util';
import { featureNotInPlanProblem } from '../../../../core/models/company-plan.model';

const OPEN_STATUSES: readonly ClientSubscriptionStatus[] = ['Active', 'Overdue', 'AwaitingPayment', 'Paused'];

/**
 * Meu plano do cliente numa empresa: plano atual e planos disponiveis. A empresa vem de quem usa (slug e nome): a area do
 * cliente passa a da URL.
 */
@Component({
  selector: 'app-client-subscription',
  standalone: true,
  imports: [CommonModule, IconComponent, ConfirmDialogComponent],
  templateUrl: './client-subscription.component.html',
  styleUrl: './client-subscription.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientSubscriptionComponent {
  readonly describePlanProfessionals = describePlanProfessionals;
  private readonly clientSubscriptionApiService = inject(ClientSubscriptionApiService);
  readonly companySlug = input.required<string>();
  readonly companyName = input('');
  private loading?: Subscription;

  readonly subscription = signal<ClientSubscriptionDetails | null>(null);
  readonly availablePlans = signal<PublicSubscriptionPlan[]>([]);
  readonly selectedInterestPlan = signal<PublicSubscriptionPlan | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  /** A empresa nao tem o clube no plano da HL (403 feature-not-in-plan): a tela so diz que nao ha planos, sem erro. */
  readonly unavailable = signal(false);
  readonly interestMessage = signal('');
  /** Plano em andamento (ativo, em atraso, aguardando ou pausado): os demais sao "outros" planos (B19). */
  readonly hasCurrentSubscription = computed(() => OPEN_STATUSES.includes(this.subscription()?.status as ClientSubscriptionStatus));
  readonly availablePlansTitle = computed(() => this.hasCurrentSubscription() ? 'Outros planos disponíveis' : 'Planos disponíveis');
  /** Com o nome cadastrado da empresa; sem ele (ainda carregando), a frase fica sem nome, nunca com um provisorio. */
  readonly interestDescription = computed(() => (this.companyName() ? `Seu interesse fica registrado para a ${this.companyName()}.` : 'Seu interesse fica registrado.'));

  /** Carrega o plano atual e os planos disponiveis ao abrir a secao e de novo quando a empresa muda. */
  constructor() {
    effect(() => {
      this.companySlug();
      untracked(() => {
        this.subscription.set(null);
        this.availablePlans.set([]);
        this.loadSubscriptionPageData();
      });
    });
  }

  /** Traduz status da assinatura para texto de cliente. */
  getStatusLabel(status: ClientSubscriptionStatus): string {
    const labels: Record<ClientSubscriptionStatus, string> = {
      AwaitingPayment: 'Aguardando confirmação do pagamento',
      Active: 'Ativo',
      Paused: 'Pausado',
      Expired: 'Expirado',
      Cancelled: 'Cancelado',
      Overdue: 'Em atraso'
    };

    return labels[status];
  }

  /** Retorna se beneficios podem ser usados no agendamento. */
  /** Plano promocional: a proxima renovacao so acontece se cair dentro da cobertura; senao o plano termina antes dela. */
  renewsOnNextRenewalDate(subscription: ClientSubscriptionDetails): boolean {
    return !subscription.coveredUntil || subscription.nextRenewalDate <= subscription.coveredUntil;
  }

  canUseBenefits(subscription: ClientSubscriptionDetails): boolean {
    return subscription.status === 'Active';
  }

  /**
   * Em atraso (B19): os usos que sobram no ciclo nao somem, so ficam travados ate o pagamento. Mostra quantos voltam
   * a valer, em vez de "Disponíveis 0" ao lado de 4 do plano e 1 reservado.
   */
  getBlockedUntilPaymentQuantity(benefit: ClientSubscriptionBenefit): number {
    return Math.max(benefit.allowedQuantity - benefit.usedQuantity - benefit.reservedQuantity, 0);
  }

  /** Traduz status da assinatura para o modificador de cor do selo. */
  getStatusPillModifier(status: ClientSubscriptionStatus): string {
    const modifiers: Record<ClientSubscriptionStatus, string> = {
      AwaitingPayment: 'awaiting',
      Active: 'active',
      Paused: 'paused',
      Expired: 'expired',
      Cancelled: 'cancelled',
      Overdue: 'overdue'
    };

    return modifiers[status];
  }

  /** Calcula o percentual utilizado do beneficio para a barra de progresso. */
  getUsedPercent(benefit: ClientSubscriptionBenefit): number {
    return benefit.allowedQuantity > 0 ? Math.min(100, (benefit.usedQuantity / benefit.allowedQuantity) * 100) : 0;
  }

  /** Calcula o percentual reservado do beneficio para a barra de progresso. */
  getReservedPercent(benefit: ClientSubscriptionBenefit): number {
    return benefit.allowedQuantity > 0 ? Math.min(100, (benefit.reservedQuantity / benefit.allowedQuantity) * 100) : 0;
  }

  /** Traduz a periodicidade do plano para texto curto na area do cliente. */
  getBillingPeriodLabel(billingPeriod: ClientSubscriptionBillingPeriod | PublicSubscriptionBillingPeriod): string {
    return billingPeriod === 'Monthly' ? 'Mensal' : billingPeriod;
  }

  /** Formata quantidade e servico do beneficio do plano disponivel. */
  getPlanBenefitLabel(plan: PublicSubscriptionPlan, serviceName: string, quantityPerPeriod: number): string {
    return `${quantityPerPeriod} ${serviceName}${this.getMonthlySuffix(plan.billingPeriod)}`;
  }

  /** Indica se o plano disponivel corresponde ao plano atual do cliente. */
  isCurrentPlan(plan: PublicSubscriptionPlan): boolean {
    return this.subscription()?.subscriptionPlanId === plan.id;
  }

  /** Abre confirmacao de interesse sem criar assinatura automaticamente. */
  openInterestModal(plan: PublicSubscriptionPlan): void {
    if (this.isCurrentPlan(plan)) {
      return;
    }

    this.selectedInterestPlan.set(plan);
  }

  /** Fecha a confirmacao de interesse sem acionar checkout ou pagamento. */
  closeInterestModal(): void {
    this.selectedInterestPlan.set(null);
  }

  /** Registra apenas a intencao visual de assinatura nesta etapa. */
  confirmInterest(): void {
    const plan = this.selectedInterestPlan();

    if (!plan) {
      return;
    }

    this.interestMessage.set(`Interesse registrado para o plano ${plan.name}.`);
    this.selectedInterestPlan.set(null);
  }

  /** Carrega plano atual e planos publicos reais sem alterar a regra do plano ativo. */
  private loadSubscriptionPageData(): void {
    // Trocar de empresa cancela o pedido da anterior: a resposta dela nao pode cair na tela da nova.
    this.loading?.unsubscribe();
    const companySlug = this.companySlug();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.unavailable.set(false);
    this.interestMessage.set('');

    this.loading = forkJoin({
      subscription: this.clientSubscriptionApiService.getCurrentSubscription(companySlug, true),
      availablePlans: this.clientSubscriptionApiService.getAvailablePlans(companySlug)
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ subscription, availablePlans }) => {
          this.subscription.set(subscription);
          this.availablePlans.set(availablePlans);
        },
        error: (error: unknown) => featureNotInPlanProblem(error) ? this.unavailable.set(true) : this.errorMessage.set('Não foi possível carregar seus planos.')
      });
  }

  /** Retorna sufixo curto para beneficios mensais. */
  private getMonthlySuffix(billingPeriod: PublicSubscriptionBillingPeriod): string {
    return billingPeriod === 'Monthly' ? '/mês' : '';
  }
}
