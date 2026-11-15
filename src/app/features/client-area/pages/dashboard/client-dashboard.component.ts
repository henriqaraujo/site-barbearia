import { ClientLoyaltyApiService } from '../../services/client-loyalty-api.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../../core/utils/api-error-message.util';
import { RouterLink } from '@angular/router';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { CustomerSessionService } from '../../../../core/services/customer-session.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClientStatusBadgeComponent } from '../../components/client-status-badge/client-status-badge.component';
import { ClientAppointment } from '../../models/client-area.model';
import { ClientAppointmentService } from '../../services/client-appointment.service';
import { ClientFormatService } from '../../services/client-format.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TenantUrlPipe } from '../../../../core/tenancy/tenant-url.pipe';
import { TermPipe } from '../../../../shared/pipes/term.pipe';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [TermPipe, RouterLink, IconComponent, ClientStatusBadgeComponent, ConfirmDialogComponent, TenantUrlPipe],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDashboardComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  /** WhatsApp e "Como chegar" da barbearia da URL; sem cadastro, o botao some. */
  readonly companyContext = inject(CompanyContextService);
  private readonly appointmentService = inject(ClientAppointmentService);
  readonly formatService = inject(ClientFormatService);
  /** Saldo de pontos (o layout carrega); o card so aparece com o programa ligado. */
  readonly loyaltySummary = inject(ClientLoyaltyApiService).summary;

  readonly currentUser = this.customerSessions.currentCustomer;
  readonly selectedAppointment = signal<ClientAppointment | null>(null);
  readonly feedbackMessage = signal('');
  /** Erro do cancelamento, mostrado no proprio dialogo (que continua aberto); a mensagem da pagina fica atras dele. */
  readonly cancellationErrorMessage = signal('');
  readonly isCancelling = signal(false);
  readonly clientId = computed(() => this.currentUser()?.id ?? '');
  readonly nextAppointment = computed(() => this.appointmentService.getNextAppointment(this.clientId()));
  readonly summary = computed(() => this.appointmentService.createClientSummary(this.clientId()));
  readonly lastAppointment = computed(() => this.appointmentService.getLastCompletedAppointment(this.clientId()));
  readonly daysSinceLastAppointment = computed(() => {
    const last = this.lastAppointment();

    if (!last) {
      return null;
    }

    const elapsedMs = Date.now() - new Date(`${last.date}T${last.time || '00:00'}`).getTime();
    const elapsedDays = Math.floor(elapsedMs / 86400000);

    return elapsedDays >= 0 ? elapsedDays : null;
  });

  constructor() {
    this.loadAppointments();
  }

  /** Carrega do backend o proximo agendamento e o historico vinculados ao CustomerId autenticado. */
  private loadAppointments(): void {
    this.appointmentService.loadAppointments().subscribe({
      error: () => this.feedbackMessage.set('Não foi possível carregar seus agendamentos.')
    });
    this.appointmentService.loadHistory().subscribe({ error: () => undefined });
  }

  /** Abre a confirmacao visual para cancelamento do proximo agendamento. */
  openCancelConfirmation(appointment: ClientAppointment): void {
    this.selectedAppointment.set(appointment);
    this.cancellationErrorMessage.set('');
  }

  /** Cancela o agendamento selecionado no backend para liberar reserva de assinatura. */
  confirmCancellation(): void {
    const appointment = this.selectedAppointment();

    if (!appointment || this.isCancelling()) {
      return;
    }

    this.isCancelling.set(true);
    this.cancellationErrorMessage.set('');
    this.appointmentService.cancelAppointment(appointment.id, 'Cancelado pelo cliente').pipe(finalize(() => this.isCancelling.set(false))).subscribe({
      next: () => {
        this.feedbackMessage.set('Agendamento cancelado.');
        this.selectedAppointment.set(null);
      },
      error: (error: unknown) => this.cancellationErrorMessage.set(apiErrorMessage(error, 'Não foi possível cancelar o agendamento.'))
    });
  }

  /** Fecha o modal sem alterar o estado mockado. */
  closeModal(): void {
    this.selectedAppointment.set(null);
  }
}
