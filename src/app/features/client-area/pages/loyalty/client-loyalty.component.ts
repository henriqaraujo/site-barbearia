import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { apiErrorMessage } from '../../../../core/utils/api-error-message.util';
import { featureNotInPlanProblem } from '../../../../core/models/company-plan.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClientLoyalty, ClientLoyaltyRedemption, ClientLoyaltyRedemptionStatus, ClientLoyaltyReward, ClientLoyaltyTransaction } from '../../models/client-loyalty.model';
import { ClientLoyaltyApiService } from '../../services/client-loyalty-api.service';
import { TermPipe } from '../../../../shared/pipes/term.pipe';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ClientLoyaltyRedemptionStatus, string> = {
  Requested: 'Solicitado',
  Delivered: 'Entregue',
  Rejected: 'Recusado',
  Cancelled: 'Cancelado'
};

/**
 * "Meus pontos" do cliente (Fase 5): saldo, como ganhar, recompensas com Resgatar, meus pedidos (com cancelar enquanto
 * Solicitado) e extrato. Sem niveis. Com o programa pausado, o saldo e os pedidos continuam visiveis, sem pedir novos.
 * A empresa vem de quem usa (slug): a area do cliente passa a da URL.
 */
@Component({
  selector: 'app-client-loyalty',
  standalone: true,
  imports: [TermPipe, DatePipe, RouterLink, IconComponent, ConfirmDialogComponent],
  templateUrl: './client-loyalty.component.html',
  styleUrl: './client-loyalty.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientLoyaltyComponent {
  private readonly loyaltyApiService = inject(ClientLoyaltyApiService);
  private readonly destroyRef = inject(DestroyRef);
  private loading?: Subscription;

  readonly companySlug = input.required<string>();

  readonly loyalty = signal<ClientLoyalty | null>(null);
  readonly transactions = signal<ClientLoyaltyTransaction[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly errorMessage = signal('');
  /** A empresa nao tem a fidelidade no plano da HL (403 feature-not-in-plan): so avisa que nao ha programa, sem erro. */
  readonly unavailable = signal(false);
  readonly feedbackMessage = signal('');
  readonly page = signal(1);
  readonly hasMore = computed(() => this.transactions().length < (this.loyalty()?.totalTransactions ?? 0));

  readonly redeeming = signal<ClientLoyaltyReward | null>(null);
  readonly cancelling = signal<ClientLoyaltyRedemption | null>(null);
  readonly isBusy = signal(false);
  readonly dialogErrorMessage = signal('');

  constructor() {
    // Carrega ao abrir e de novo quando a empresa muda (o Angular reaproveita a pagina ao trocar de empresa na URL).
    effect(() => {
      this.companySlug();
      untracked(() => {
        this.loyalty.set(null);
        this.transactions.set([]);
        this.feedbackMessage.set('');
        this.load();
      });
    });
  }

  load(): void {
    // Trocar de empresa cancela o pedido da anterior: a resposta dela nao pode cair na tela da nova.
    this.loading?.unsubscribe();
    const companySlug = this.companySlug();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.unavailable.set(false);
    this.loading = this.loyaltyApiService.getLoyalty(companySlug, 1, PAGE_SIZE)
      .pipe(finalize(() => this.isLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loyalty) => this.show(loyalty),
        error: (error: unknown) => featureNotInPlanProblem(error) ? this.unavailable.set(true) : this.errorMessage.set('Não foi possível carregar seus pontos. Tente de novo em instantes.')
      });
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) {
      return;
    }

    const nextPage = this.page() + 1;
    this.isLoadingMore.set(true);
    this.loyaltyApiService.getLoyalty(this.companySlug(), nextPage, PAGE_SIZE)
      .pipe(finalize(() => this.isLoadingMore.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loyalty) => {
          this.transactions.update((current) => [...current, ...loyalty.transactions.filter((item) => !current.some((existing) => existing.id === item.id))]);
          this.page.set(nextPage);
        },
        error: () => this.feedbackMessage.set('Não foi possível carregar mais movimentos.')
      });
  }

  /** "Como ganhar" na regra por real. */
  perRealText(loyalty: ClientLoyalty): string {
    return loyalty.pointsPerReal === 1
      ? 'Você ganha 1 ponto a cada R$ 1,00 nos atendimentos concluídos.'
      : `Você ganha ${loyalty.pointsPerReal.toLocaleString('pt-BR')} pontos a cada R$ 1,00 nos atendimentos concluídos.`;
  }

  /** Motivo de nao poder resgatar agora (programa pausado, servico indisponivel ou saldo). */
  blockReason(reward: ClientLoyaltyReward): string {
    const loyalty = this.loyalty();
    if (!loyalty) {
      return '';
    }

    if (!loyalty.programEnabled) {
      return 'Resgates pausados no momento.';
    }

    if (reward.unavailable) {
      return reward.unavailable;
    }

    const missing = reward.pointsCost - loyalty.balance;
    return missing > 0 ? `Faltam ${missing.toLocaleString('pt-BR')} ${missing === 1 ? 'ponto' : 'pontos'}.` : '';
  }

  rewardKind(reward: ClientLoyaltyReward): string {
    return reward.type === 'FreeService' ? `Serviço grátis${reward.serviceName ? ': ' + reward.serviceName : ''}` : 'Retire no local';
  }

  statusLabel(status: ClientLoyaltyRedemptionStatus): string {
    return STATUS_LABELS[status];
  }

  statusTone(status: ClientLoyaltyRedemptionStatus): string {
    return status === 'Requested' ? 'warning' : status === 'Delivered' ? 'success' : 'neutral';
  }

  /** O que acontece com o pedido agora. */
  redemptionDetail(redemption: ClientLoyaltyRedemption): string {
    if (redemption.status === 'Rejected') {
      return redemption.rejectionReason ? `Motivo: ${redemption.rejectionReason}. Os pontos voltaram para o seu saldo.` : 'Os pontos voltaram para o seu saldo.';
    }

    if (redemption.status === 'Cancelled') {
      return 'Você cancelou; os pontos voltaram para o seu saldo.';
    }

    if (redemption.status === 'Delivered') {
      return 'Entregue.';
    }

    if (redemption.appointmentStartDateTime) {
      const start = new Date(redemption.appointmentStartDateTime);
      return `Reservado para o seu horário de ${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
    }

    return redemption.rewardType === 'FreeService'
      ? 'Ao agendar este serviço, marque "Usar resgate" e o horário sai sem custo.'
      : 'Retire no local.';
  }

  formatPoints(points: number): string {
    return `${points > 0 ? '+' : ''}${points.toLocaleString('pt-BR')}`;
  }

  openRedeem(reward: ClientLoyaltyReward): void {
    if (this.blockReason(reward)) {
      return;
    }

    this.dialogErrorMessage.set('');
    this.feedbackMessage.set('');
    this.redeeming.set(reward);
  }

  confirmRedeem(): void {
    const reward = this.redeeming();
    if (!reward || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.dialogErrorMessage.set('');
    this.loyaltyApiService.redeem(this.companySlug(), reward.id)
      .pipe(finalize(() => this.isBusy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.redeeming.set(null);
          this.feedbackMessage.set(reward.type === 'FreeService'
            ? `Resgate de ${reward.name} pedido. Ao agendar este serviço, marque "Usar resgate" e o horário sai sem custo.`
            : `Resgate de ${reward.name} pedido. Retire no local.`);
          this.load();
        },
        error: (error: unknown) => this.dialogErrorMessage.set(apiErrorMessage(error, 'Não foi possível pedir o resgate.'))
      });
  }

  openCancel(redemption: ClientLoyaltyRedemption): void {
    this.dialogErrorMessage.set('');
    this.feedbackMessage.set('');
    this.cancelling.set(redemption);
  }

  confirmCancel(): void {
    const redemption = this.cancelling();
    if (!redemption || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.dialogErrorMessage.set('');
    this.loyaltyApiService.cancelRedemption(this.companySlug(), redemption.id)
      .pipe(finalize(() => this.isBusy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelling.set(null);
          this.feedbackMessage.set(`Pedido cancelado. ${redemption.pointsCost.toLocaleString('pt-BR')} pontos voltaram para o seu saldo.`);
          this.load();
        },
        error: (error: unknown) => this.dialogErrorMessage.set(apiErrorMessage(error, 'Não foi possível cancelar o pedido.'))
      });
  }

  closeDialogs(): void {
    if (!this.isBusy()) {
      this.redeeming.set(null);
      this.cancelling.set(null);
    }
  }

  private show(loyalty: ClientLoyalty): void {
    this.loyalty.set(loyalty);
    this.transactions.set(loyalty.transactions);
    this.page.set(1);
  }
}
