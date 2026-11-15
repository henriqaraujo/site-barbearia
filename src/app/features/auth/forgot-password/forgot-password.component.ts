import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { routeCompanySlug } from '../../../core/tenancy/route-company-slug';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthBrandComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../login/login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly message = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly companySlug = routeCompanySlug(this.activatedRoute.snapshot);
  readonly loginLink = this.companySlug ? `/${this.companySlug}/login` : '/entrar';
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] })
  });

  /**
   * Recuperacao de senha da conta do cliente (vale em todas as empresas; conta unica, Fase 3), em /{slug}/esqueci-senha
   * e /entrar/esqueci-senha. Sucesso mostra sempre a mesma mensagem generica, exista ou nao o e-mail; 429 mostra quanto
   * esperar; qualquer outra falha pede nova tentativa, sem fingir que o link saiu.
   */
  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set(null);
    this.errorMessage.set(null);
    this.customerSessions.requestPasswordReset(this.form.getRawValue().email).subscribe({
      next: (response) => {
        this.message.set(`${response.message} Confira também a caixa de spam.`);
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(tooManyAttemptsMessage(error) ?? 'Não foi possível enviar. Tente novamente.');
        this.isSubmitting.set(false);
      }
    });
  }
}
