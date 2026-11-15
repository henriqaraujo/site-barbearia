import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerFavorite, CustomerFavoritesService } from '../../../../core/services/customer-favorites.service';
import { FavoriteToggleComponent } from '../../../../shared/components/favorite-toggle/favorite-toggle.component';
import { companyInitial, companyLogo } from '../../my-account-format';

/**
 * Favoritos em /minha-conta (Fase 6): as empresas que a conta marcou com o coracao, em ordem alfabetica, com "Agendar"
 * e o coracao para tirar. Empresa inativa nao aparece (F1).
 */
@Component({
  selector: 'app-my-account-favorites',
  standalone: true,
  imports: [RouterLink, FavoriteToggleComponent],
  templateUrl: './my-account-favorites.component.html',
  styleUrls: ['../../my-account-host.scss', '../../my-account-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountFavoritesComponent implements OnInit {
  private readonly favoritesService = inject(CustomerFavoritesService);

  readonly favorites = this.favoritesService.favorites;
  readonly isLoaded = this.favoritesService.isLoaded;
  readonly errorMessage = this.favoritesService.errorMessage;
  readonly logo = companyLogo;
  readonly initial = companyInitial;

  ngOnInit(): void {
    this.favoritesService.ensureLoaded();
  }

  place(company: CustomerFavorite): string {
    if (!company.city) {
      return '';
    }

    return [company.neighborhood, company.state ? `${company.city}/${company.state}` : company.city].filter(Boolean).join(' · ');
  }
}
