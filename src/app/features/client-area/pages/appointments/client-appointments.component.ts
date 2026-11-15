import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../../core/utils/api-error-message.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { CustomerSessionService } from '../../../../core/services/customer-session.service';
import { CustomDropdownDirective } from '../../../../shared/directives/custom-dropdown.directive';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClientStatusBadgeComponent } from '../../components/client-status-badge/client-status-badge.component';
import { ClientAppointment } from '../../models/client-area.model';
import { ClientSubscriptionDetails } from '../../models/client-subscription.model';
import { ClientAppointmentService } from '../../services/client-appointment.service';
import { ClientFormatService } from '../../services/client-format.service';
import { ClientSubscriptionApiService } from '../../services/client-subscription-api.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TenantUrlPipe } from '../../../../core/tenancy/tenant-url.pipe';
import { TermPipe } from '../../../../shared/pipes/term.pipe';

/** Quantos agendamentos entram por vez na rolagem infinita. */
const PAGE_SIZE = 12;
const SCROLL_THRESHOLD_PX = 360;

interface PlanBenefitsSummary {
  allowed: number;
  used: number;
  reserved: number;
  available: number;
}

interface AppointmentDateGroup {
  readonly dateKey: string;
  readonly label: string;
  readonly items: readonly ClientAppointment[];
}

@Component({
  selector: 'app-client-appointments',
  standalone: true,
  imports: [TermPipe, 
    CommonModule,
    FormsModule,
    RouterLink,
    CustomDropdownDirective,
    IconComponent,
    ClientStatusBadgeComponent,
    ConfirmDialogComponent
  , TenantUrlPipe],
  templateUrl: './client-appointments.component.html',
  styleUrl: './client-appointments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientAppointmentsComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  /** WhatsApp e "Como chegar" da barbearia da URL; sem cadastro, o botao some. */
  readonly companyContext = inject(CompanyContextService);
  private readonly appointmentService = inject(ClientAppointmentService);
  private readonly subscriptionApiService = inject(ClientSubscriptionApiService);
  readonly formatService = inject(ClientFormatService);

  readonly cancellationReason = signal('');
  readonly selectedAppointment = signal<ClientAppointment | null>(null);
  readonly feedbackMessage = signal('');
  /** Erro do cancelamento, mostrado no proprio dialogo (que continua aberto); a mensagem da pagina fica atras dele. */
  readonly cancellationErrorMessage = signal('');
  readonly isCancelling = signal(false);
  readonly subscription = signal<ClientSubscriptionDetails | null>(null);
  readonly clientId = computed(() => this.customerSessions.currentCustomer()?.id ?? '');
  readonly upcomingAppointments = computed(() => this.appointmentService.getUpcomingAppointments(this.clientId()));
  readonly nextAppointment = computed(() => this.appointmentService.getNextAppointment(this.clientId()));
  readonly next7DaysCount = computed(() => {
    const cutoffDate = this.formatDateOnly(addDays(new Date(), 7));
    return this.upcomingAppointments().filter((appointment) => appointment.date <= cutoffDate).length;
  });
  readonly coveredByPlanCount = computed(() => this.upcomingAppointments().filter((appointment) => !!appointment.subscriptionPlanName).length);
  readonly hasActiveSubscription = computed(() => this.subscription()?.status === 'Active');
  /** Rolagem infinita: os agendamentos entram por lote conforme o cliente desce a pagina. */
  private readonly visibleCount = signal(PAGE_SIZE);
  readonly hasMoreAppointments = computed(() => this.visibleCount() < this.upcomingAppointments().length);
  readonly groupedAppointments = computed<AppointmentDateGroup[]>(() =>
    groupAppointmentsByDate(this.upcomingAppointments().slice(0, this.visibleCount()))
  );

  /** Carrega o proximo lote quando a pagina chega perto do fim. */
  @HostListener('window:scroll')
  loadMoreNearBottom(): void {
    if (!this.hasMoreAppointments()) {
      return;
    }

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - SCROLL_THRESHOLD_PX) {
      this.visibleCount.update((count) => count + PAGE_SIZE);
    }
  }
  readonly planBenefitsSummary = computed<PlanBenefitsSummary | null>(() => {
    const benefits = this.subscription()?.currentPeriod?.benefits ?? [];

    if (!benefits.length) {
      return null;
    }

    return benefits.reduce((totals, benefit) => ({
      allowed: totals.allowed + benefit.allowedQuantity,
      used: totals.used + benefit.usedQuantity,
      reserved: totals.reserved + benefit.reservedQuantity,
      available: totals.available + benefit.availableQuantity
    }), { allowed: 0, used: 0, reserved: 0, available: 0 });
  });

  constructor() {
    this.loadAppointments();
    this.loadSubscription();
  }

  /** Carrega do backend os agendamentos vinculados ao CustomerId autenticado. */
  private loadAppointments(): void {
    this.appointmentService.loadAppointments().subscribe({
      error: () => this.feedbackMessage.set('Não foi possível carregar seus agendamentos.')
    });
  }

  /** Carrega a assinatura real do cliente para o resumo lateral do plano, sem bloquear a lista de agendamentos em caso de falha. */
  private loadSubscription(): void {
    this.subscriptionApiService.getCurrentSubscription(this.companyContext.companySlug()).subscribe({
      next: (subscription) => this.subscription.set(subscription),
      error: () => this.subscription.set(null)
    });
  }

  /** Abre o modal de cancelamento com motivo opcional. */
  openCancellation(appointment: ClientAppointment): void {
    this.selectedAppointment.set(appointment);
    this.cancellationErrorMessage.set('');
    this.cancellationReason.set('');
  }

  /** Atualiza o motivo digitado no modal. */
  updateCancellationReason(reason: string): void {
    this.cancellationReason.set(reason);
  }

  /** Confirma cancelamento real e move o item para cancelados apos resposta da API. */
  confirmCancellation(): void {
    const appointment = this.selectedAppointment();

    if (!appointment || this.isCancelling()) {
      return;
    }

    this.isCancelling.set(true);
    this.cancellationErrorMessage.set('');
    this.appointmentService.cancelAppointment(appointment.id, this.cancellationReason()).pipe(finalize(() => this.isCancelling.set(false))).subscribe({
      next: () => {
        this.feedbackMessage.set('Agendamento cancelado. Ele passa a constar apenas no seu histórico.');
        this.selectedAppointment.set(null);
      },
      error: (error: unknown) => this.cancellationErrorMessage.set(apiErrorMessage(error, 'Não foi possível cancelar o agendamento.'))
    });
  }

  /** Fecha o modal sem cancelar o agendamento. */
  closeModal(): void {
    this.selectedAppointment.set(null);
  }

  /** Formata uma data local em "yyyy-MM-dd" para comparar com o campo date dos agendamentos. */
  private formatDateOnly(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

/** Soma dias a uma data sem alterar a instancia original. */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const dateHeadingFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

/** Agrupa agendamentos por data preservando a ordem original, apenas para exibicao. */
function groupAppointmentsByDate(appointments: readonly ClientAppointment[]): AppointmentDateGroup[] {
  const groups = new Map<string, ClientAppointment[]>();

  for (const appointment of appointments) {
    const groupItems = groups.get(appointment.date) ?? [];
    groupItems.push(appointment);
    groups.set(appointment.date, groupItems);
  }

  return Array.from(groups.entries()).map(([dateKey, items]) => ({
    dateKey,
    label: formatDateHeading(dateKey),
    items
  }));
}

/** Formata "yyyy-MM-dd" em "Dia-da-semana, dd de mês", com fuso local. */
function formatDateHeading(dateKey: string): string {
  const label = dateHeadingFormatter.format(new Date(`${dateKey}T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
