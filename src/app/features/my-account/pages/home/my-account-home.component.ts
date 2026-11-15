import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerSessionService } from '../../../../core/services/customer-session.service';
import { MyAccountAppointmentCardComponent } from '../../components/appointment-card/my-account-appointment-card.component';
import { MyAccountAppointment, MyAccountCompany } from '../../models/my-account.model';
import { companyInitial, companyLogo } from '../../my-account-format';
import { MyAccountApiService } from '../../services/my-account-api.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Inicio de /minha-conta: proximos agendamentos de todas as empresas e as empresas da conta (Fase 4). */
@Component({
  selector: 'app-my-account-home',
  standalone: true,
  imports: [RouterLink, MyAccountAppointmentCardComponent],
  templateUrl: './my-account-home.component.html',
  styleUrls: ['../../my-account-host.scss', '../../my-account-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountHomeComponent implements OnInit {
  private readonly api = inject(MyAccountApiService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = this.customerSessions.account;
  readonly firstName = computed(() => this.account()?.fullName.trim().split(/\s+/)[0] ?? '');
  readonly state = signal<LoadState>('loading');
  readonly upcoming = signal<MyAccountAppointment[]>([]);
  readonly companies = signal<MyAccountCompany[]>([]);
  readonly hasMoreUpcoming = signal(false);
  readonly resendMessage = signal<string | null>(null);
  readonly logo = companyLogo;
  readonly initial = companyInitial;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    forkJoin({ page: this.api.appointments('upcoming', null), companies: this.api.companies() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ page, companies }) => {
          this.upcoming.set(page.items.slice(0, 5));
          this.hasMoreUpcoming.set(page.items.length > 5 || page.hasMore);
          this.companies.set(companies);
          this.state.set('ready');
        },
        error: () => this.state.set('error')
      });
  }

  resendVerification(): void {
    this.customerSessions.resendVerification().subscribe({
      next: () => this.resendMessage.set('Enviamos um novo link para o seu e-mail.'),
      error: () => this.resendMessage.set('Não foi possível enviar agora. Tente de novo em alguns minutos.')
    });
  }
}
