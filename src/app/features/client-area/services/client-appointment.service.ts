import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { AppointmentStatus, ClientAppointment, ClientSummary } from '../models/client-area.model';

interface BackendClientAppointment {
  readonly id: string;
  readonly customerId: string;
  readonly service: {
    readonly id: string;
    readonly name: string;
    readonly durationInMinutes: number;
    readonly price: number;
  };
  readonly professional: {
    readonly id: string;
    readonly name: string;
  };
  readonly date: string;
  readonly time: string;
  readonly durationInMinutes: number;
  readonly price: number;
  readonly status: string;
  readonly cancellationReason: string | null;
  readonly subscriptionPlanName: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientAppointmentService {
  private readonly httpClient = inject(HttpClient);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly appointmentsValue = signal<ClientAppointment[]>([]);
  private readonly historyValue = signal<ClientAppointment[]>([]);
  readonly appointments = this.appointmentsValue.asReadonly();
  readonly history = this.historyValue.asReadonly();

  /** Carrega do backend somente os agendamentos ativos e futuros (Confirmed) do cliente autenticado. */
  loadAppointments(): Observable<ClientAppointment[]> {
    return this.httpClient.get<BackendClientAppointment[]>(this.createAppointmentsUrl()).pipe(
      map((appointments) => appointments.map((appointment) => this.mapBackendAppointment(appointment))),
      tap((appointments) => this.appointmentsValue.set(appointments))
    );
  }

  /** Carrega do backend o historico (concluidos, cancelados e faltas) do cliente autenticado. */
  loadHistory(): Observable<ClientAppointment[]> {
    return this.httpClient.get<BackendClientAppointment[]>(this.createHistoryUrl()).pipe(
      map((appointments) => appointments.map((appointment) => this.mapBackendAppointment(appointment))),
      tap((appointments) => this.historyValue.set(appointments))
    );
  }

  /** Lista agendamentos ativos e futuros do cliente informado, ja ordenados por data/hora crescente pelo backend. */
  getUpcomingAppointments(clientId: string): ClientAppointment[] {
    return this.appointmentsValue().filter((appointment) => appointment.clientId === clientId);
  }

  /** Retorna o proximo agendamento ativo usado no dashboard. */
  getNextAppointment(clientId: string): ClientAppointment | null {
    return this.getUpcomingAppointments(clientId)[0] ?? null;
  }

  /** Cancela agendamento real do cliente e remove o item da lista de ativos, pois o registro passa a fazer parte apenas do historico. */
  cancelAppointment(appointmentId: string, reason: string): Observable<ClientAppointment> {
    return this.httpClient.delete<BackendClientAppointment>(
      `${this.createAppointmentsUrl()}/${encodeURIComponent(appointmentId)}`,
      { body: { reason } }
    ).pipe(
      map((appointment) => this.mapBackendAppointment(appointment)),
      tap((cancelledAppointment) => this.removeAppointment(cancelledAppointment.id))
    );
  }

  /** Resume metricas do cliente a partir do historico real de atendimentos concluidos. */
  createClientSummary(clientId: string): ClientSummary {
    const completed = this.getCompletedHistory(clientId);
    const totalSpent = completed.reduce((sum, appointment) => sum + appointment.price, 0);
    const professionalVisits = new Map<string, number>();

    completed.forEach((appointment) => professionalVisits.set(appointment.professional.name, (professionalVisits.get(appointment.professional.name) ?? 0) + 1));

    return {
      totalVisits: completed.length,
      totalSpent,
      favoriteProfessional: this.findFavoriteProfessionalName(professionalVisits)
    };
  }

  /** Atendimentos concluidos do cliente, do mais recente para o mais antigo. */
  getCompletedHistory(clientId: string): ClientAppointment[] {
    return this.historyValue()
      .filter((appointment) => appointment.clientId === clientId && appointment.status === 'completed')
      .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));
  }

  /** Ultimo atendimento concluido, base real para a sugestao de reagendamento. */
  getLastCompletedAppointment(clientId: string): ClientAppointment | null {
    return this.getCompletedHistory(clientId)[0] ?? null;
  }

  private findFavoriteProfessionalName(professionalVisits: Map<string, number>): string {
    return [...professionalVisits.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] ?? '-';
  }

  /** Remove da lista de ativos um agendamento que deixou de ser upcoming (ex.: apos cancelamento). */
  private removeAppointment(appointmentId: string): void {
    this.appointmentsValue.update((appointments) => appointments.filter((appointment) => appointment.id !== appointmentId));
  }

  /** Converte o DTO do backend para o modelo usado pelas telas da area do cliente. */
  private mapBackendAppointment(appointment: BackendClientAppointment): ClientAppointment {
    return {
      id: appointment.id,
      clientId: appointment.customerId,
      service: appointment.service,
      professional: {
        id: appointment.professional.id,
        name: appointment.professional.name,
        specialty: '',
        rating: 0,
        photoUrl: ''
      },
      date: appointment.date,
      time: appointment.time,
      durationInMinutes: appointment.durationInMinutes,
      price: appointment.price,
      status: this.mapBackendStatus(appointment.status),
      cancellationReason: appointment.cancellationReason ?? undefined,
      subscriptionPlanName: appointment.subscriptionPlanName ?? undefined
    };
  }

  /** Normaliza status do backend para as abas e badges existentes no frontend. */
  private mapBackendStatus(status: string): AppointmentStatus {
    if (status === 'Completed') {
      return 'completed';
    }

    if (status === 'CancelledByCustomer' || status === 'CancelledByCompany' || status === 'NoShow') {
      return 'cancelled';
    }

    return 'confirmed';
  }

  private createAppointmentsUrl(): string {
    return `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/companies/${encodeURIComponent(this.companyContextService.companySlug())}/appointments/me`;
  }

  private createHistoryUrl(): string {
    return `${this.createAppointmentsUrl()}/history`;
  }
}
