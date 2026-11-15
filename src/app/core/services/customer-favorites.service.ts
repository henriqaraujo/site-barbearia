import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, of, shareReplay, switchMap, tap } from 'rxjs';
import { CustomerSessionService, customerAccountApiUrl } from './customer-session.service';

/** Empresa favorita: os campos publicos do cartao da vitrine (F7). */
export interface CustomerFavorite {
  readonly slug: string;
  readonly name: string;
  readonly logoUrl: string;
  readonly neighborhood: string | null;
  readonly city: string | null;
  readonly state: string | null;
}

/** Intencao de favoritar guardada na aba ao mandar entrar (F4): nunca na URL, para um link pronto nao favoritar sozinho. */
const INTENT_KEY = 'hl-gestao-favorite-intent';
const INTENT_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Favoritos da conta do cliente (Fase 6, plano 5.4). A lista e carregada uma vez por sessao e serve o coracao do perfil,
 * dos cartoes da vitrine e as listas. Sem conta logada, o coracao guarda a intencao na aba e manda para o /entrar; na
 * volta, a pagina chama applyPendingIntent e o favorito e aplicado.
 */
@Injectable({ providedIn: 'root' })
export class CustomerFavoritesService {
  private readonly httpClient = inject(HttpClient);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly accountId = computed(() => this.customerSessions.account()?.id ?? null);
  /** A lista e a conta dona dela: saiu da conta (ou trocou), a lista anterior deixa de valer sozinha. */
  private readonly state = signal<{ accountId: string; items: CustomerFavorite[] } | null>(null);
  /** Carga em andamento: quem chega no meio (aplicar o favorito pendente) espera a mesma, sem pedir de novo. */
  private loading$: Observable<CustomerFavorite[]> | null = null;

  readonly isLoaded = computed(() => {
    const state = this.state();
    return state !== null && state.accountId === this.accountId();
  });
  readonly favorites = computed(() => (this.isLoaded() ? this.state()!.items : []));
  /** Slugs com gravacao em andamento (o coracao fica ocupado). */
  readonly saving = signal<ReadonlySet<string>>(new Set());
  readonly errorMessage = signal('');
  private readonly slugs = computed(() => new Set(this.favorites().map((favorite) => favorite.slug)));

  isFavorite(slug: string): boolean {
    return this.slugs().has(slug);
  }

  isSaving(slug: string): boolean {
    return this.saving().has(slug);
  }

  /** Carrega a lista da conta logada, uma vez (sem conta, nada). */
  ensureLoaded(): void {
    if (!this.customerSessions.isAccountAuthenticated() || this.isLoaded() || this.loading$) {
      return;
    }

    this.sharedLoad().subscribe();
  }

  /**
   * Coracao: com conta, grava ou tira; sem conta, guarda a intencao na aba e vai para o /entrar, que volta para
   * returnUrl (a vitrine ou o perfil).
   */
  toggle(slug: string, returnUrl: string): void {
    if (!this.customerSessions.isAccountAuthenticated()) {
      writeIntent(slug);
      void this.router.navigate(['/entrar'], { queryParams: { returnUrl } });
      return;
    }

    this.save(slug, !this.isFavorite(slug)).subscribe();
  }

  /** Na volta do /entrar: aplica o favorito pedido antes de entrar (so o desta pagina, quando informado). */
  applyPendingIntent(expectedSlug?: string): void {
    if (!this.customerSessions.isAccountAuthenticated()) {
      return;
    }

    const slug = readIntent();
    if (!slug || (expectedSlug !== undefined && slug !== expectedSlug)) {
      return;
    }

    clearIntent();
    this.ensureListThen(() => {
      if (!this.isFavorite(slug)) {
        this.save(slug, true).subscribe();
      }
    });
  }

  private ensureListThen(action: () => void): void {
    if (this.isLoaded()) {
      action();
      return;
    }

    this.sharedLoad().subscribe(() => action());
  }

  private sharedLoad(): Observable<CustomerFavorite[]> {
    if (!this.loading$) {
      this.loading$ = this.load().pipe(finalize(() => (this.loading$ = null)), shareReplay(1));
    }

    return this.loading$;
  }

  private load(): Observable<CustomerFavorite[]> {
    const accountId = this.accountId();
    return this.httpClient.get<CustomerFavorite[]>(`${customerAccountApiUrl()}/favorites`).pipe(
      tap((favorites) => {
        if (accountId !== null) {
          this.state.set({ accountId, items: favorites });
        }
      }),
      catchError(() => of<CustomerFavorite[]>([]))
    );
  }

  private save(slug: string, favorite: boolean): Observable<unknown> {
    if (this.isSaving(slug)) {
      return of(null);
    }

    this.errorMessage.set('');
    this.setSaving(slug, true);
    const url = `${customerAccountApiUrl()}/favorites/${encodeURIComponent(slug)}`;
    const request$ = favorite ? this.httpClient.put<void>(url, {}) : this.httpClient.delete<void>(url);
    return request$.pipe(
      // A lista volta do servidor (dados do cartao e a ordem dele).
      switchMap(() => this.load()),
      catchError((error: unknown) => {
        this.errorMessage.set(favoriteErrorMessage(error));
        return of(null);
      }),
      finalize(() => this.setSaving(slug, false))
    );
  }

  private setSaving(slug: string, saving: boolean): void {
    const next = new Set(this.saving());
    if (saving) {
      next.add(slug);
    } else {
      next.delete(slug);
    }

    this.saving.set(next);
  }
}

function favoriteErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 409 && typeof error.error?.detail === 'string') {
    return error.error.detail;
  }

  return 'Não foi possível salvar o favorito agora. Tente de novo em instantes.';
}

function writeIntent(slug: string): void {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    // Sem armazenamento da aba: depois de entrar a pessoa clica de novo.
  }
}

function readIntent(): string | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    const intent = raw ? (JSON.parse(raw) as { slug?: unknown; at?: unknown }) : null;
    if (!intent || typeof intent.slug !== 'string' || typeof intent.at !== 'number' || Date.now() - intent.at > INTENT_MAX_AGE_MS) {
      return null;
    }

    return intent.slug;
  } catch {
    return null;
  }
}

function clearIntent(): void {
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // Nada a limpar.
  }
}
