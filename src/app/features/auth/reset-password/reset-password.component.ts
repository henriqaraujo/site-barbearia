import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ResetPasswordRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { routeCompanySlug } from '../../../core/tenancy/route-company-slug';
import { clearLinkSecrets, readLinkParams } from '../../../core/utils/link-token.util';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';

/** Senha do painel exige letra e numero; a do cliente segue a regra do cadastro do site (8 a 128 caracteres). */
const ADMIN_PASSWORD_VALIDATORS: ValidatorFn[] = [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)];
const CUSTOMER_PASSWORD_VALIDATORS: ValidatorFn[] = [Validators.required, Validators.minLength(8), Validators.maxLength(128)];

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [PasswordFieldComponent, ReactiveFormsModule, RouterLink, AuthBrandComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../login/login.component.scss', './reset-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  readonly message = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly hasTokenFromLink: boolean;
  /** Empresa do endereco (/{slug}/redefinir-senha): so decide o login de volta; a senha e a da conta (Fase 3). */
  readonly customerCompanySlug: string | null;
  /** Link da conta do cliente: /entrar/redefinir-senha (os novos) ou /{slug}/redefinir-senha. */
  readonly isCustomerAccount: boolean;
  /** Login de volta: o do cliente (da empresa ou da raiz) ou o da equipe. */
  readonly loginUrl: string;
  /**
   * Cliente com link que nao vale mais (sem token, link antigo por empresa de antes do deploy da Fase 3, ja usado ou
   * vencido): a tela troca o formulario por "Este link nao vale mais" e "Pedir um novo link" (esqueci a senha da conta).
   */
  readonly linkExpired = signal(false);
  readonly forgotPasswordUrl: string;
  readonly form = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: ADMIN_PASSWORD_VALIDATORS }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  private readonly customerSessions = inject(CustomerSessionService);

  constructor(
    private readonly authService: AuthService,
    activatedRoute: ActivatedRoute,
    location: Location
  ) {
    // Token no fragmento (S7); a query so vale para links enviados antes da mudanca.
    const linkParams = readLinkParams(activatedRoute.snapshot);
    const token = linkParams.get('token') ?? '';

    this.hasTokenFromLink = token.length > 0;
    // Cliente: /{slug}/redefinir-senha, empresa da rota. O link antigo de cliente (/redefinir-senha com
    // conta=cliente&empresa=x) ja chega aqui redirecionado pelo legacyCustomerResetRedirect.
    this.customerCompanySlug = routeCompanySlug(activatedRoute.snapshot);
    this.isCustomerAccount = this.customerCompanySlug !== null || activatedRoute.snapshot.data['customerAccount'] === true;
    this.loginUrl = this.customerCompanySlug ? `/${this.customerCompanySlug}/login` : this.isCustomerAccount ? '/entrar' : '/login';
    this.forgotPasswordUrl = this.customerCompanySlug ? `/${this.customerCompanySlug}/esqueci-senha` : '/entrar/esqueci-senha';
    // Os links da conta usam /entrar/redefinir-senha. Em /{slug}/redefinir-senha so chegam links do fluxo antigo por
    // empresa (inclusive o /redefinir-senha com conta=cliente, redirecionado), cujos tokens o deploy da Fase 3 apagou.
    this.linkExpired.set(this.isCustomerAccount && (!this.hasTokenFromLink || this.customerCompanySlug !== null));
    this.form.controls.token.setValue(token);
    if (this.hasTokenFromLink) {
      clearLinkSecrets(location);
    }

    if (this.isCustomerAccount) {
      this.form.controls.newPassword.setValidators(CUSTOMER_PASSWORD_VALIDATORS);
      this.form.controls.newPassword.updateValueAndValidity();
    }
  }

  /** Envia token e nova senha quando a confirmacao local esta correta. */
  submit(): void {
    if (this.form.invalid || this.passwordsDoNotMatch() || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.message.set(null);

    this.resetPassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.message.set('Senha redefinida com sucesso. Você já pode entrar com a nova senha.');
        this.form.disable();
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        if (this.isCustomerAccount && error instanceof HttpErrorResponse && error.status === 401) {
          this.linkExpired.set(true);
          return;
        }

        this.errorMessage.set(tooManyAttemptsMessage(error) ?? 'Link inválido ou expirado. Solicite uma nova redefinição de senha.');
      }
    });
  }

  passwordsDoNotMatch(): boolean {
    return this.form.controls.confirmPassword.touched && this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value;
  }

  private resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.isCustomerAccount ? this.customerSessions.resetPassword(request) : this.authService.resetPassword(request);
  }
}
