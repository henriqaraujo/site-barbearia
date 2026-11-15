import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MyAccountAppointmentCardComponent } from '../../components/appointment-card/my-account-appointment-card.component';
import { MyAccountAppointment, MyAccountAppointmentScope, MyAccountCompany } from '../../models/my-account.model';
import { MyAccountApiService } from '../../services/my-account-api.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Agendamentos de todas as empresas da conta (Fase 4, roteiro 6): proximos e historico, filtro por empresa, paginado. */
@Component({
  selector: 'app-my-account-appointments',
  standalone: true,
  imports: [MyAccountAppointmentCardComponent],
  templateUrl: './my-account-appointments.component.html',
  styleUrls: ['../../my-account-host.scss', '../../my-account-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountAppointmentsComponent implements OnInit {
  private readonly api = inject(MyAccountApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly scope = signal<MyAccountAppointmentScope>('upcoming');
  readonly company = signal<string | null>(null);
  readonly companies = signal<MyAccountCompany[]>([]);
  readonly items = signal<MyAccountAppointment[]>([]);
  readonly page = signal(1);
  readonly hasMore = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly loadingMore = signal(false);

  ngOnInit(): void {
    this.api.companies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (companies) => this.companies.set(companies),
      error: () => this.companies.set([])
    });
    this.load();
  }

  selectScope(scope: MyAccountAppointmentScope): void {
    if (this.scope() !== scope) {
      this.scope.set(scope);
      this.load();
    }
  }

  selectCompany(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.company.set(value || null);
    this.load();
  }

  /** Primeira pagina do periodo e da empresa escolhidos. */
  load(): void {
    this.state.set('loading');
    this.page.set(1);
    this.api.appointments(this.scope(), this.company(), 1).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.hasMore.set(page.hasMore);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }

  loadMore(): void {
    const nextPage = this.page() + 1;
    this.loadingMore.set(true);
    this.api.appointments(this.scope(), this.company(), nextPage).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.items.update((items) => [...items, ...page.items]);
        this.page.set(nextPage);
        this.hasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false)
    });
  }
}
