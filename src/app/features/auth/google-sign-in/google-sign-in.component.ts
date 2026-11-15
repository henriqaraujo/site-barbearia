import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AcceptedLegalDocument, PendingLegalDocument } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { GoogleIdentityService } from '../../../core/services/google-identity.service';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { CustomerLegalAcceptanceComponent } from '../customer-legal-acceptance/customer-legal-acceptance.component';

const GOOGLE_BUTTON_MAX_WIDTH = 400;

/**
 * Botao "Continuar com Google" das telas do cliente (conta unica, Fase 3). So aparece quando a API informa um Client ID.
 * Conta nova pelo Google (ou com documentos novos) passa pelo aceite dos Termos e da Privacidade antes da sessao: o
 * mesmo credential e mandado de novo com os documentos aceitos.
 */
@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  imports: [CustomerLegalAcceptanceComponent],
  templateUrl: './google-sign-in.component.html',
  styleUrl: './google-sign-in.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GoogleSignInComponent {
  private readonly authService = inject(AuthService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly googleIdentityService = inject(GoogleIdentityService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly buttonHost = viewChild.required<ElementRef<HTMLElement>>('googleButton');
  private credential: string | null = null;

  /** Sessao da conta aplicada; a tela decide o redirecionamento. */
  readonly authenticated = output<void>();
  readonly isAvailable = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingDocuments = signal<PendingLegalDocument[] | null>(null);

  constructor() {
    afterNextRender(() => this.setUp());
  }

  acceptDocuments(documents: AcceptedLegalDocument[]): void {
    this.login(documents);
  }

  /** Volta ao botao do Google, descartando o credential pendente. */
  cancelAcceptance(): void {
    this.credential = null;
    this.pendingDocuments.set(null);
    this.errorMessage.set(null);
  }

  private setUp(): void {
    this.authService.getAuthOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((options) => {
      if (!options.googleClientId) {
        return;
      }

      this.googleIdentityService.load().then((googleAccountsId) => {
        googleAccountsId.initialize({
          client_id: options.googleClientId!,
          ux_mode: 'popup',
          context: 'signin',
          callback: (response) => this.ngZone.run(() => this.handleCredential(response.credential))
        });
        googleAccountsId.renderButton(this.buttonHost().nativeElement, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'pt-BR',
          width: Math.min(this.buttonHost().nativeElement.clientWidth || GOOGLE_BUTTON_MAX_WIDTH, GOOGLE_BUTTON_MAX_WIDTH)
        });
        this.isAvailable.set(true);
      }).catch(() => {
        // Sem o script do Google (bloqueador, rede) o login por e-mail e senha continua disponivel.
        this.isAvailable.set(false);
      });
    });
  }

  private handleCredential(credential: string): void {
    this.credential = credential;
    this.login();
  }

  private login(acceptedDocuments?: AcceptedLegalDocument[]): void {
    if (!this.credential) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.customerSessions.loginWithGoogle({ credential: this.credential, acceptedDocuments }).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        if (result.status === 'legal-acceptance-required') {
          this.pendingDocuments.set(result.documents);
          return;
        }

        this.pendingDocuments.set(null);
        this.authenticated.emit();
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.createErrorMessage(error));
        // Credential recusado (ou vencido) nao serve para nova tentativa: volta ao botao do Google.
        this.credential = null;
        this.pendingDocuments.set(null);
      }
    });
  }

  private createErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Não foi possível conectar ao servidor.';
    }

    if (error.status === 401 || error.status === 409) {
      return error.error?.detail ?? 'Não foi possível entrar com o Google.';
    }

    return tooManyAttemptsMessage(error) ?? 'Não foi possível entrar com o Google agora.';
  }
}
