import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CompanyContextService } from '../../core/services/company-context.service';
import { PublicBookingApiService } from '../../core/services/public-booking-api.service';
import { isWellFormedCompanySlug } from '../../core/tenancy/company-slug-rules';
import { routeCompanySlug } from '../../core/tenancy/route-company-slug';
import { clearLinkSecrets, readLinkParams } from '../../core/utils/link-token.util';
import { tooManyAttemptsMessage } from '../../core/utils/rate-limit-message.util';

type WaitlistCancelStatus = 'ready' | 'submitting' | 'done' | 'invalid' | 'error';

/**
 * Sair da fila sem conta pelo link recebido (S10): /{slug}/fila/cancelar#token=... So cancela no clique, nunca
 * ao abrir a pagina, para um leitor de links do e-mail nao tirar a pessoa da fila sozinho.
 */
@Component({
  selector: 'app-waitlist-cancel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './waitlist-cancel.component.html',
  styleUrl: './waitlist-cancel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WaitlistCancelComponent {
  private readonly publicBookingApiService = inject(PublicBookingApiService);
  /** Nome cadastrado da empresa da URL; vazio so enquanto carrega (a frase sai sem nome, nunca com um provisorio). */
  readonly companyName = inject(CompanyContextService).fullName;
  private readonly token: string;
  private readonly companySlug: string;

  readonly status = signal<WaitlistCancelStatus>('ready');
  readonly errorMessage = signal<string | null>(null);
  /** Inicio do site da empresa do link, ou a raiz quando o link nao traz empresa valida. */
  readonly homeUrl: string;

  constructor(activatedRoute: ActivatedRoute, location: Location) {
    const linkParams = readLinkParams(activatedRoute.snapshot);
    // A empresa vem da rota. O link antigo (/fila/cancelar#token=...&empresa=x) ja chega aqui redirecionado pelo
    // legacyWaitlistCancelRedirect; sem empresa valida, fica em /fila/cancelar e o link e invalido.
    const companySlug = routeCompanySlug(activatedRoute.snapshot) ?? '';
    this.token = linkParams.get('token') ?? '';
    this.companySlug = isWellFormedCompanySlug(companySlug) ? companySlug : '';
    this.homeUrl = this.companySlug ? `/${this.companySlug}` : '/';

    if (this.token) {
      clearLinkSecrets(location);
    }

    if (!this.token || !this.companySlug) {
      this.status.set('invalid');
    }
  }

  leave(): void {
    if (this.status() !== 'ready' && this.status() !== 'error') {
      return;
    }

    this.status.set('submitting');
    this.errorMessage.set(null);

    this.publicBookingApiService.leaveWaitlist(this.companySlug, this.token).subscribe({
      next: () => this.status.set('done'),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.status.set('invalid');
          return;
        }

        this.errorMessage.set(tooManyAttemptsMessage(error) ?? 'Não foi possível sair da fila agora. Tente novamente em instantes.');
        this.status.set('error');
      }
    });
  }
}
