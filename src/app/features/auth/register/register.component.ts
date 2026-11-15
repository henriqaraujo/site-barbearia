import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { visibleLegalDocuments } from '../../../core/legal/legal-documents';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { routeCompanySlug } from '../../../core/tenancy/route-company-slug';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { LegalLinksComponent } from '../../../shared/components/legal-links/legal-links.component';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { matchingPasswordsValidator, phoneNumberValidator } from './customer-register.validators';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';

type RegisterCustomerForm = FormGroup<{
  name: FormControl<string>;
  phone: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
  acceptedTerms: FormControl<boolean>;
}>;

/**
 * Cadastro da conta do cliente (conta unica, Fase 3), em /{slug}/cadastro e /entrar/cadastro. A resposta e sempre a
 * mesma, exista ou nao a conta do e-mail (S3): a tela nunca entra sozinha depois do cadastro (entrar so quando a senha
 * bate revelaria a conta) e mostra o mesmo aviso com o caminho para entrar.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [PasswordFieldComponent, ReactiveFormsModule, RouterLink, AuthBrandComponent, GoogleSignInComponent, LegalLinksComponent],
  templateUrl: './register.component.html',
  styleUrl: '../login/login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly companySlug = routeCompanySlug(this.activatedRoute.snapshot);
  readonly loginLink = this.companySlug ? `/${this.companySlug}/login` : '/entrar';
  readonly siteLink = this.companySlug ? `/${this.companySlug}` : '/';
  /** Documentos que o site mostra (em producao, rascunho nao aparece nem e exigido). */
  readonly legalDocuments = visibleLegalDocuments();
  /** Os mesmos documentos com o separador da frase ("Termos de Uso e Politica de Privacidade."). */
  readonly legalDocumentLinks = this.legalDocuments.map((document, index, all) => ({ ...document, separator: index === all.length - 1 ? '.' : ' e ' }));
  readonly errorMessage = signal<string | null>(null);
  readonly sentMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly form: RegisterCustomerForm = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(160)] }),
      phone: new FormControl('', { nonNullable: true, validators: [Validators.required, phoneNumberValidator()] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(180)] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      acceptedTerms: new FormControl(false, { nonNullable: true, validators: this.legalDocuments.length > 0 ? [Validators.requiredTrue] : [] })
    },
    { validators: [matchingPasswordsValidator('password', 'confirmPassword')] }
  );

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    this.customerSessions.register({
      fullName: value.name,
      phone: value.phone,
      email: value.email,
      password: value.password,
      confirmPassword: value.confirmPassword,
      acceptedDocuments: this.legalDocuments.map((document) => ({ id: document.id, version: document.version }))
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.sentMessage.set(response.message);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.createErrorMessage(error));
        this.isSubmitting.set(false);
      }
    });
  }

  /** Login concluido pelo Google: a sessao da conta ja foi aplicada. */
  completeGoogleLogin(): void {
    void this.router.navigateByUrl(this.companySlug ? `/${this.companySlug}/cliente` : '/minha-conta');
  }

  /** Para o login: o e-mail digitado e o destino de antes (returnUrl). */
  getLoginQueryParams(): { returnUrl?: string; email?: string } | null {
    const returnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ?? undefined;
    const email = this.sentMessage() ? this.form.controls.email.value : undefined;
    return returnUrl || email ? { returnUrl, email } : null;
  }

  private createErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Não foi possível conectar ao servidor.';
    }

    if (error.status === 400) {
      return error.error?.detail ?? 'Confira os dados informados e tente novamente.';
    }

    return tooManyAttemptsMessage(error) ?? 'Não foi possível concluir o cadastro agora.';
  }
}
