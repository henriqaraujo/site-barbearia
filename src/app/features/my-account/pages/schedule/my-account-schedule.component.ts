import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CustomerFavoritesService } from '../../../../core/services/customer-favorites.service';
import { MyAccountCompany } from '../../models/my-account.model';
import { companyInitial, companyLogo } from '../../my-account-format';
import { MyAccountApiService } from '../../services/my-account-api.service';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * "Agendar" em /minha-conta (Fase 4): escolhe a empresa entre as da conta e vai para o agendamento dela; outra empresa
 * pela busca da pagina inicial (a vitrine da Fase 5). Os favoritos (Fase 6) vem logo abaixo, com o mesmo "Agendar".
 */
@Component({
  selector: 'app-my-account-schedule',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-account-schedule.component.html',
  styleUrls: ['../../my-account-host.scss', '../../my-account-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountScheduleComponent implements OnInit {
  private readonly api = inject(MyAccountApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly favoritesService = inject(CustomerFavoritesService);

  readonly state = signal<LoadState>('loading');
  readonly companies = signal<MyAccountCompany[]>([]);
  readonly favorites = this.favoritesService.favorites;
  readonly logo = companyLogo;
  readonly initial = companyInitial;

  ngOnInit(): void {
    this.load();
    this.favoritesService.ensureLoaded();
  }

  load(): void {
    this.state.set('loading');
    this.api.companies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }
}
