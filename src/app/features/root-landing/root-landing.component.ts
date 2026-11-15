import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { PLATFORM_BRAND } from '../../core/constants/platform-brand.constants';
import { UI_TERMS } from '../../core/constants/ui-terms';
import { CustomerFavoritesService } from '../../core/services/customer-favorites.service';
import {
  DIRECTORY_FEATURES,
  PublicDirectoryApiService,
  PublicDirectoryCity,
  PublicDirectoryCompany,
  PublicDirectorySearch,
  PublicNearbyCompany
} from '../../core/services/public-directory-api.service';
import { resolveApiMediaUrl } from '../../core/utils/api-media-url.util';
import { HeaderComponent } from '../../layout/header/header.component';
import { FavoriteToggleComponent } from '../../shared/components/favorite-toggle/favorite-toggle.component';
import { LegalLinksComponent } from '../../shared/components/legal-links/legal-links.component';

/** idle: Buscar sem termo, antes de a pessoa buscar (nada e listado, como no AppBarber). */
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type NearbyState = 'idle' | 'locating' | 'ready' | 'denied' | 'error';

/** "inicio" (/): favoritos, "Perto de você" e a lista; "buscar" (/buscar): o formulario de nome e cidade. */
export type DirectoryMode = 'inicio' | 'buscar';

/** Campos do cartao: os da busca e os dos favoritos (sem cidade quando a empresa nao cadastrou). */
type CardCompany = Pick<PublicDirectoryCompany, 'slug' | 'name' | 'logoUrl'> & { neighborhood: string | null; city: string | null; state: string | null; distanceKm?: number };

/**
 * Vitrine do HL Gestao (Fase 5; cabecalho e Inicio/Buscar pedidos pelo dono em 07/10, no estilo do AppBarber). Inicio
 * (/) mostra "Seus favoritos" (com conta), "Perto de você" (front pronto, desligado em DIRECTORY_FEATURES ate o back
 * existir) e as empresas da vitrine em ordem alfabetica; Buscar (/buscar) e a busca por nome e cidade
 * (?q=&cidade=&uf=). So aparecem empresas com "Aparecer na busca" ligado (o padrao desde 07/10).
 */
@Component({
  selector: 'app-root-landing',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet, LegalLinksComponent, FavoriteToggleComponent, HeaderComponent],
  templateUrl: './root-landing.component.html',
  styleUrl: './root-landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RootLandingComponent implements OnInit {
  readonly terms = UI_TERMS;
  readonly brand = PLATFORM_BRAND;
  private readonly api = inject(PublicDirectoryApiService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cityTerms = new Subject<string>();
  private readonly customerFavorites = inject(CustomerFavoritesService);

  readonly mode: DirectoryMode = this.activatedRoute.snapshot.data['mode'] === 'buscar' ? 'buscar' : 'inicio';
  readonly nearbyEnabled = inject(DIRECTORY_FEATURES).nearby;
  readonly today = formatToday(new Date());
  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    cidade: new FormControl('', { nonNullable: true })
  });
  readonly state = signal<LoadState>('loading');
  readonly companies = signal<PublicDirectoryCompany[]>([]);
  readonly cities = signal<PublicDirectoryCity[]>([]);
  readonly hasMore = signal(false);
  readonly page = signal(1);
  readonly loadingMore = signal(false);
  readonly termError = signal<string | null>(null);
  readonly searched = signal<PublicDirectorySearch>({ q: null, cidade: null, uf: null });
  readonly nearbyState = signal<NearbyState>('idle');
  readonly nearby = signal<PublicNearbyCompany[]>([]);
  /** Fase 6: favoritos da conta logada. */
  readonly favorites = this.customerFavorites.favorites;
  readonly favoriteError = this.customerFavorites.errorMessage;
  /** Logos cujo arquivo nao carregou: o cartao mostra a inicial, nunca a imagem quebrada. */
  private readonly failedLogos = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    if (this.mode === 'buscar') {
      const params = this.activatedRoute.snapshot.queryParamMap;
      const initial: PublicDirectorySearch = { q: params.get('q'), cidade: params.get('cidade'), uf: params.get('uf') };
      this.form.setValue({ q: initial.q ?? '', cidade: initial.cidade ? cityLabel(initial.cidade, initial.uf) : '' });
      this.cityTerms.pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.api.cities(term.length >= 2 ? term : null).pipe(catchError(() => of([])))),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((cities) => this.cities.set(cities));
      this.cityTerms.next('');
      // Buscar so lista depois de a pessoa buscar (pedido do dono, 08/10); as empresas da vitrine ficam no Inicio.
      if (hasTerms(initial)) {
        this.load(initial);
      } else {
        this.state.set('idle');
      }
    } else {
      this.load({ q: null, cidade: null, uf: null });
    }

    // Na volta do /entrar, aplica o favorito pedido num cartao (F4).
    this.customerFavorites.ensureLoaded();
    this.customerFavorites.applyPendingIntent();
  }

  /** O /entrar volta para a pagina como estava. */
  returnUrl(): string {
    return this.router.url || '/';
  }

  cityTyped(): void {
    this.cityTerms.next(parseCity(this.form.controls.cidade.value).cidade ?? '');
  }

  submit(): void {
    const q = this.form.controls.q.value.trim();
    if (q.length === 1) {
      this.termError.set('Digite pelo menos 2 letras.');
      return;
    }

    const { cidade, uf } = parseCity(this.form.controls.cidade.value);
    const search: PublicDirectorySearch = { q: q || null, cidade, uf };
    if (!hasTerms(search)) {
      this.termError.set('Digite o nome ou a cidade para buscar.');
      return;
    }

    this.termError.set(null);
    void this.router.navigate([], { queryParams: { q: search.q, cidade: search.cidade, uf: search.uf }, replaceUrl: true });
    this.load(search);
  }

  /** Volta a Buscar para antes da busca: sem lista e sem termos na URL. */
  clear(): void {
    this.form.setValue({ q: '', cidade: '' });
    this.termError.set(null);
    this.searched.set({ q: null, cidade: null, uf: null });
    this.companies.set([]);
    this.hasMore.set(false);
    this.state.set('idle');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  loadMore(): void {
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.api.search(this.searched(), next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.companies.update((companies) => [...companies, ...result.items]);
        this.page.set(next);
        this.hasMore.set(result.hasMore);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false)
    });
  }

  /** "Perto de você": pede a localizacao ao navegador e busca as empresas proximas (so com DIRECTORY_FEATURES.nearby). */
  findNearby(): void {
    if (!this.nearbyEnabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      this.nearbyState.set('error');
      return;
    }

    this.nearbyState.set('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.api.nearby(position.coords.latitude, position.coords.longitude).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (companies) => {
            this.nearby.set(companies);
            this.nearbyState.set('ready');
          },
          error: () => this.nearbyState.set('error')
        });
      },
      () => this.nearbyState.set('denied'),
      { maximumAge: 5 * 60 * 1000, timeout: 15000 }
    );
  }

  distance(company: CardCompany): string {
    if (company.distanceKm === undefined) {
      return '';
    }

    return company.distanceKm < 1
      ? `${Math.round(company.distanceKm * 1000)} m`
      : `${company.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  }

  logo(company: CardCompany): string {
    return resolveApiMediaUrl(company.logoUrl);
  }

  logoFailed(company: CardCompany): boolean {
    return this.failedLogos().has(company.slug);
  }

  markLogoFailed(company: CardCompany): void {
    this.failedLogos.update((failed) => new Set(failed).add(company.slug));
  }

  initial(company: CardCompany): string {
    return company.name.trim().charAt(0).toUpperCase();
  }

  place(company: CardCompany): string {
    if (!company.city) {
      return '';
    }

    return [company.neighborhood, company.state ? `${company.city}/${company.state}` : company.city].filter(Boolean).join(' · ');
  }

  cityLabel(city: PublicDirectoryCity): string {
    return cityLabel(city.city, city.state);
  }

  private load(search: PublicDirectorySearch): void {
    this.searched.set(search);
    this.state.set('loading');
    this.page.set(1);
    this.api.search(search, 1).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.companies.set(result.items);
        this.hasMore.set(result.hasMore);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }
}

/** A busca tem nome ou cidade: sem nenhum dos dois, Buscar nao lista nada. */
function hasTerms(search: PublicDirectorySearch): boolean {
  return !!search.q || !!search.cidade;
}

function cityLabel(city: string, state: string | null): string {
  return state ? `${city} - ${state}` : city;
}

/** "Campo Grande - MS" (opcao da lista) vira cidade e UF; texto livre vira so a cidade. */
function parseCity(value: string): { cidade: string | null; uf: string | null } {
  const text = value.trim();
  const match = /^(.+?)\s+-\s+([A-Za-z]{2})$/.exec(text);
  if (match) {
    return { cidade: match[1].trim(), uf: match[2].toUpperCase() };
  }

  return { cidade: text || null, uf: null };
}

/** "Quarta, 7 out 2026", como no AppBarber. */
function formatToday(date: Date): string {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date).replace('-feira', '');
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.getDate()} ${month} ${date.getFullYear()}`;
}
