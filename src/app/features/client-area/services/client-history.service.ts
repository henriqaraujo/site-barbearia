import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ClientAppointmentService } from './client-appointment.service';
import { ClientAppointment, ClientHistoryRecord, ClientServiceReview, HistorySortOrder } from '../models/client-area.model';

export interface ClientHistoryFilters {
  search: string;
  period: string;
  professionalId: string;
  sortOrder: HistorySortOrder;
}

@Injectable({ providedIn: 'root' })
export class ClientHistoryService {
  private readonly appointmentService = inject(ClientAppointmentService);
  private readonly reviewsValue = signal<Record<string, ClientServiceReview>>({});
  readonly filters = signal<ClientHistoryFilters>({ search: '', period: 'all', professionalId: 'all', sortOrder: 'recent' });
  readonly history = computed<ClientHistoryRecord[]>(() => this.appointmentService.history()
    .map((appointment) => this.toHistoryRecord(appointment)));
  readonly filteredHistory = computed(() => this.filterHistory(this.history(), this.filters()));

  /** Carrega do backend o historico real (concluidos, cancelados e faltas) do cliente autenticado. */
  loadHistory(): Observable<ClientAppointment[]> {
    return this.appointmentService.loadHistory();
  }

  /** Define os filtros usados pelo computed de historico. */
  updateFilters(filters: Partial<ClientHistoryFilters>): void {
    this.filters.update((currentFilters) => ({ ...currentFilters, ...filters }));
  }

  /** Salva avaliacao em memoria local, associada ao agendamento concluido. */
  saveReview(recordId: string, review: ClientServiceReview): void {
    this.reviewsValue.update((reviews) => ({ ...reviews, [recordId]: review }));
  }

  /** Retorna profissionais distintos para o filtro da pagina. */
  getProfessionals(clientId: string): { id: string; name: string }[] {
    const professionals = new Map<string, string>();
    this.history().filter((record) => record.clientId === clientId).forEach((record) => professionals.set(record.professional.id, record.professional.name));
    return [...professionals.entries()].map(([id, name]) => ({ id, name }));
  }

  /** Converte um agendamento concluido do backend no formato exibido pelo historico. */
  private toHistoryRecord(appointment: ClientAppointment): ClientHistoryRecord {
    return {
      id: appointment.id,
      clientId: appointment.clientId,
      date: appointment.date,
      service: appointment.service,
      professional: appointment.professional,
      paidAmount: appointment.price,
      paymentMethod: appointment.subscriptionPlanName ? `Plano ${appointment.subscriptionPlanName}` : 'Não informado',
      status: appointment.status,
      review: this.reviewsValue()[appointment.id]
    };
  }

  private filterHistory(records: ClientHistoryRecord[], filters: ClientHistoryFilters): ClientHistoryRecord[] {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const minimumDate = this.getMinimumDate(filters.period);

    return records
      .filter((record) => !normalizedSearch || record.service.name.toLowerCase().includes(normalizedSearch) || record.professional.name.toLowerCase().includes(normalizedSearch))
      .filter((record) => filters.professionalId === 'all' || record.professional.id === filters.professionalId)
      .filter((record) => !minimumDate || record.date >= minimumDate)
      .sort((first, second) => filters.sortOrder === 'recent' ? second.date.localeCompare(first.date) : first.date.localeCompare(second.date));
  }

  private getMinimumDate(period: string): string | null {
    const today = new Date();

    if (period === '30') {
      today.setDate(today.getDate() - 30);
      return this.formatDateValue(today);
    }

    if (period === '90') {
      today.setDate(today.getDate() - 90);
      return this.formatDateValue(today);
    }

    return null;
  }

  private formatDateValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
