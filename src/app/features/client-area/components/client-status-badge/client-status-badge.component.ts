import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AppointmentStatus } from '../../models/client-area.model';

@Component({
  selector: 'app-client-status-badge',
  standalone: true,
  templateUrl: './client-status-badge.component.html',
  styleUrl: './client-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientStatusBadgeComponent {
  readonly status = input.required<AppointmentStatus>();
  readonly statusLabel = computed(() => this.createStatusLabel(this.status()));

  /** Traduz o status tecnico para exibicao em portugues. */
  private createStatusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      scheduled: 'Agendado',
      confirmed: 'Confirmado',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };

    return labels[status];
  }
}
