import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { clearLinkSecrets, readLinkParams } from '../../../core/utils/link-token.util';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { LegalLinksComponent } from '../../../shared/components/legal-links/legal-links.component';
import { MyAccountMessage } from '../../my-account/models/my-account.model';
import { MyAccountApiService } from '../../my-account/services/my-account-api.service';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';

type LinkMode = 'confirm' | 'revert';
type LinkState = 'working' | 'done' | 'failed';

/**
 * Links da troca de e-mail da conta do cliente (Fase 4), no padrao das telas de entrada:
 * - /entrar/confirmar-novo-email#token=: confirma o endereco novo; todas as sessoes caem e a pessoa entra de novo;
 * - /entrar/desfazer-troca-de-email#token= ("Nao fui eu"): volta o endereco antigo; as sessoes caem e a tela sugere
 *   redefinir a senha.
 * O token sai da barra de endereco assim que e lido (S4).
 */
@Component({
  selector: 'app-email-change-link',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent, AuthBrandComponent],
  templateUrl: './email-change-link.component.html',
  styleUrl: '../login/login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailChangeLinkComponent implements OnInit {
  private readonly api = inject(MyAccountApiService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly token: string;

  readonly mode: LinkMode;
  readonly title: string;
  readonly state = signal<LinkState>('working');
  readonly message = signal<string | null>(null);

  constructor(activatedRoute: ActivatedRoute, location: Location) {
    this.mode = activatedRoute.snapshot.data['emailChange'] === 'revert' ? 'revert' : 'confirm';
    this.title = this.mode === 'revert' ? 'Desfazer a troca de e‑mail' : 'Confirmar novo e‑mail';
    this.token = readLinkParams(activatedRoute.snapshot).get('token') ?? '';
    if (this.token) {
      clearLinkSecrets(location);
    }
  }

  ngOnInit(): void {
    if (!this.token) {
      this.fail('Link inválido ou expirado.');
      return;
    }

    const request$: Observable<MyAccountMessage> = this.mode === 'revert' ? this.api.revertEmailChange(this.token) : this.api.confirmEmailChange(this.token);
    request$.subscribe({
      next: (response) => {
        // As sessoes da conta foram encerradas no servidor: a deste navegador tambem deixa de valer.
        this.customerSessions.clear();
        this.message.set(response.message);
        this.state.set('done');
      },
      error: (error: unknown) => this.fail(tooManyAttemptsMessage(error) ?? 'Link inválido ou expirado.')
    });
  }

  private fail(message: string): void {
    this.message.set(message);
    this.state.set('failed');
  }
}
