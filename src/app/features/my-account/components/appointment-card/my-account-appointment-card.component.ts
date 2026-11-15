import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyAccountAppointment } from '../../models/my-account.model';
import { appointmentStatusLabel, companyInitial, companyLogo, formatAppointmentDate, formatPrice, isActiveStatus } from '../../my-account-format';

/** Um agendamento de qualquer empresa da conta: empresa (logo e nome), servico, data e o atalho "Ver na empresa". */
@Component({
  selector: 'app-my-account-appointment-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-account-appointment-card.component.html',
  styles: [':host { display: block; }'],
  styleUrl: '../../my-account-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountAppointmentCardComponent {
  readonly appointment = input.required<MyAccountAppointment>();
  /** Historico leva para o historico da empresa; proximos, para os agendamentos dela (onde da para cancelar). */
  readonly history = input(false);

  readonly logo = computed(() => companyLogo(this.appointment().company));
  readonly initial = computed(() => companyInitial(this.appointment().company));
  readonly date = computed(() => formatAppointmentDate(this.appointment().date));
  readonly price = computed(() => formatPrice(this.appointment().price));
  readonly statusLabel = computed(() => appointmentStatusLabel(this.appointment().status));
  readonly activeStatus = computed(() => isActiveStatus(this.appointment().status));
  readonly companyLink = computed(() => `/${this.appointment().company.slug}/cliente/${this.history() ? 'historico' : 'agendamentos'}`);
}
