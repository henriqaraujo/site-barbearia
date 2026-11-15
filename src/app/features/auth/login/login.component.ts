import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AcceptedLegalDocument, PendingLegalDocument } from '../../../core/models/auth.model';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { routeCompanySlug } from '../../../core/tenancy/route-company-slug';
import { accountReturnUrl, customerReturnUrl } from '../../../core/utils/return-url.util';
import { tooManyAttemptsMessage } from '../../../core/utils/rate-limit-message.util';
import { LegalLinksComponent } from '../../../shared/components/legal-links/legal-links.component';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';
import { CustomerLegalAcceptanceComponent } from '../customer-legal-acceptance/customer-legal-acceptance.component';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';

/**
 * Login do cliente final com a conta unica (Fase 3): o mesmo formulario em /{slug}/login (vindo da empresa) e em
 * /entrar (raiz). A conta vale em todas as empresas. Com Termos e Privacidade para aceitar, a tela mostra o aceite e
 * entra de novo mandando os documentos. A equipe entra pelo /login, sem empresa na URL.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [PasswordFieldComponent, ReactiveFormsModule, RouterLink, AuthBrandComponent, GoogleSignInComponent, LegalLinksComponent, CustomerLegalAcceptanceComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly pendingDocuments = signal<PendingLegalDocument[] | null>(null);
  readonly companySlug = routeCompanySlug(this.activatedRoute.snapshot);
  readonly registerLink = this.companySlug ? `/${this.companySlug}/cadastro` : '/entrar/cadastro';
  readonly forgotPasswordLink = this.companySlug ? `/${this.companySlug}/esqueci-senha` : '/entrar/esqueci-senha';
  readonly siteLink = this.companySlug ? `/${this.companySlug}` : '/';
  /** Volta da exclusao da conta (/minha-conta): o aviso de que deu certo. */
  readonly accountDeleted = this.activatedRoute.snapshot.queryParamMap.get('conta-excluida') === '1';
  /** Atalho para a equipe: o /login da equipe ja pre-seleciona a empresa do ?empresa= (se for da conta). */
  readonly staffLoginQueryParams = this.companySlug ? { empresa: this.companySlug } : null;
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  constructor() {
    // Vindo do cadastro: o e-mail digitado la ja aparece aqui.
    const email = this.activatedRoute.snapshot.queryParamMap.get('email');
    if (email) {
      this.form.controls.email.setValue(email);
    }
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.signIn();
  }

  /** Aceite feito: entra de novo com a mesma senha e os documentos aceitos. */
  acceptDocuments(documents: AcceptedLegalDocument[]): void {
    this.signIn(documents);
  }

  backToCredentials(): void {
    this.pendingDocuments.set(null);
    this.errorMessage.set(null);
  }

  /** Sessao aplicada pelo botao do Google: segue para onde a pessoa ia. */
  completeGoogleLogin(): void {
    this.navigateAfterLogin();
  }

  /** Mantem a rota desejada ao alternar do login para o cadastro. */
  getRegisterQueryParams(): { returnUrl: string } | null {
    const returnUrl = this.returnUrl();
    return returnUrl ? { returnUrl } : null;
  }

  private signIn(acceptedDocuments?: AcceptedLegalDocument[]): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.customerSessions.login({ ...this.form.getRawValue(), acceptedDocuments }).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        if (result.status === 'legal-acceptance-required') {
          this.pendingDocuments.set(result.documents);
          return;
        }

        this.navigateAfterLogin();
      },
      error: (error: unknown) => {
        this.pendingDocuments.set(null);
        this.errorMessage.set(tooManyAttemptsMessage(error) ?? 'E-mail ou senha inválidos.');
        this.isSubmitting.set(false);
      }
    });
  }

  /** Vindo de uma empresa: a area do cliente dela (ou o returnUrl dela). Da raiz: a /minha-conta (ou o returnUrl de la). */
  private navigateAfterLogin(): void {
    const target = this.companySlug ? customerReturnUrl(this.returnUrl(), this.companySlug) : accountReturnUrl(this.returnUrl());
    void this.router.navigateByUrl(target);
  }

  private returnUrl(): string | null {
    return this.activatedRoute.snapshot.queryParamMap.get('returnUrl');
  }
}
