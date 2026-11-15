import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UI_TERMS } from '../../../core/constants/ui-terms';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { clearLinkSecrets, readLinkParams } from '../../../core/utils/link-token.util';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { LegalLinksComponent } from '../../../shared/components/legal-links/legal-links.component';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';

type VerificationState = 'verifying' | 'verified' | 'failed';

/**
 * Confirmacao do e-mail da conta do cliente (/entrar/verificar-email#token=, D2). Funciona sem login: o link prova o
 * e-mail. Confirmado, os cadastros que a pessoa ja tinha nas empresas com este e-mail entram na conta.
 */
@Component({
  selector: 'app-customer-verify-email',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent, AuthBrandComponent],
  templateUrl: './customer-verify-email.component.html',
  styleUrl: '../login/login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerVerifyEmailComponent implements OnInit {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly token: string;

  readonly state = signal<VerificationState>('verifying');
  readonly linkedCompanies = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly isAuthenticated = this.customerSessions.isAccountAuthenticated;
  /** "Mais 1 empresa foi adicionada" / "Mais N empresas foram adicionadas" (sem logica no template). */
  readonly linkedMessage = computed(() => {
    const count = this.linkedCompanies();
    if (count === 0) {
      return null;
    }

    return count === 1
      ? `Mais 1 ${UI_TERMS.company} foi adicionada à sua conta.`
      : `Mais ${count} ${UI_TERMS.companies} foram adicionadas à sua conta.`;
  });

  constructor(activatedRoute: ActivatedRoute, location: Location) {
    this.token = readLinkParams(activatedRoute.snapshot).get('token') ?? '';
    if (this.token) {
      clearLinkSecrets(location);
    }
  }

  ngOnInit(): void {
    if (!this.token) {
      this.fail('Link de confirmação inválido ou expirado.');
      return;
    }

    this.customerSessions.verifyEmail(this.token).subscribe({
      next: (result) => {
        this.linkedCompanies.set(result.linkedCompanies);
        this.state.set('verified');
      },
      error: (error: unknown) => this.fail(tooManyAttemptsMessage(error) ?? 'Link de confirmação inválido ou expirado.')
    });
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.state.set('failed');
  }
}
