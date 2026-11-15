import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { CompanyContextService } from '../../core/services/company-context.service';
import { CustomerSessionService } from '../../core/services/customer-session.service';
import { PublicCustomerSubscription, PublicSubscriptionPlan, PublicSubscriptionPlanOverlap } from '../../core/models/public-subscription.model';
import { PublicSubscriptionsApiService } from '../../core/services/public-subscriptions-api.service';
import { RevealOnScrollDirective } from '../../shared/directives/reveal-on-scroll.directive';
import { TenantUrlPipe } from '../../core/tenancy/tenant-url.pipe';
import { describePlanProfessionals, joinNames } from '../../core/utils/plan-professionals.util';
import { featureNotInPlanProblem } from '../../core/models/company-plan.model';

@Component({
  selector: 'app-subscription-checkout',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, RevealOnScrollDirective, TenantUrlPipe],
  templateUrl: './subscription-checkout.component.html',
  styleUrl: './subscription-checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionCheckoutComponent implements OnInit {
  readonly describePlanProfessionals = describePlanProfessionals;
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly publicSubscriptionsApiService = inject(PublicSubscriptionsApiService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly customerSessions = inject(CustomerSessionService);

  /** Nome cadastrado da empresa; vazio so enquanto carrega (a frase sai sem nome, nunca com um provisorio). */
  readonly companyName = this.companyContextService.fullName;
  readonly plan = signal<PublicSubscriptionPlan | null>(null);
  readonly createdSubscription = signal<PublicCustomerSubscription | null>(null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  /** "Seu plano atual ja cobre Barba.": aviso, nao bloqueio. */
  readonly overlapWarning = signal('');
  /** Conta com cadastro de mesmo e-mail nesta empresa e e-mail ainda nao confirmado (item 7, regra 3). */
  readonly emailConfirmationMessage = signal('');
  readonly emailConfirmationFeedback = signal('');
  /** Vinculo da conta com esta empresa: null enquanto confere. */
  private readonly hasMembership = signal<boolean | null>(null);
  /** Conta sem celular (Google) e sem vinculo aqui: o vinculo novo precisa do celular, que tambem fica na conta. */
  readonly needsPhone = computed(() => this.hasMembership() === false && !this.customerSessions.account()?.phone);
  readonly phoneControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\D*(\d\D*){10,13}$/)] });

  /** Carrega o plano real selecionado na home para montar o resumo de contratacao. */
  ngOnInit(): void {
    this.loadPlan();
    if (this.customerSessions.isAccountAuthenticated()) {
      this.customerSessions.ensureSession(this.companyContextService.companySlug()).subscribe((member) => this.hasMembership.set(member));
    }
  }

  /** Confirma a solicitacao de assinatura para o cliente autenticado atual. */
  confirmSubscription(): void {
    const selectedPlan = this.plan();

    if (!selectedPlan || this.isSubmitting()) {
      return;
    }

    const phone = this.needsPhone() ? this.phoneControl.value.trim() : null;
    if (this.needsPhone() && this.phoneControl.invalid) {
      this.phoneControl.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.emailConfirmationMessage.set('');

    this.publicSubscriptionsApiService.subscribe(this.companyContextService.companySlug(), selectedPlan.id, phone).pipe(
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (subscription) => {
        this.refreshMembershipAfterSubscribe(phone !== null);
        this.createdSubscription.set(subscription);
      },
      error: (error: unknown) => this.handleSubscribeError(error)
    });
  }

  /** Reenvia o link de confirmacao do e-mail da conta. */
  resendEmailConfirmation(): void {
    this.emailConfirmationFeedback.set('');
    this.customerSessions.resendVerification().subscribe({
      next: () => this.emailConfirmationFeedback.set(`Enviamos um novo link para ${this.customerSessions.account()?.email ?? 'o seu e-mail'}. Depois de confirmar, é só contratar.`),
      error: () => this.emailConfirmationFeedback.set('Não foi possível reenviar agora. Tente novamente em instantes.')
    });
  }

  /** Exibe o periodo suportado sem acoplar o template ao enum bruto. */
  getBillingPeriodLabel(plan: PublicSubscriptionPlan): string {
    return plan.billingPeriod === 'Monthly' ? 'mês' : plan.billingPeriod;
  }

  private loadPlan(): void {
    const planId = this.activatedRoute.snapshot.paramMap.get('planId');

    if (!planId) {
      this.errorMessage.set('Plano não encontrado.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.publicSubscriptionsApiService.getSubscriptionPlan(this.companyContextService.companySlug(), planId).pipe(
      catchError((error: unknown) => {
        // Sem o clube no plano da HL da empresa: texto neutro para o cliente.
        this.errorMessage.set(featureNotInPlanProblem(error)
          ? 'Esta empresa não oferece planos de assinatura no momento.'
          : 'Plano não encontrado ou indisponível para contratação.');
        return of(null);
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe((plan) => this.plan.set(plan));

    this.publicSubscriptionsApiService.getPlanOverlap(this.companyContextService.companySlug(), planId).pipe(
      catchError(() => of([]))
    ).subscribe((overlaps) => this.overlapWarning.set(describeOverlap(overlaps)));
  }

  private handleSubscribeError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 403 && error.error?.code === 'email-confirmation-required') {
      this.emailConfirmationMessage.set(error.error?.detail ?? 'Confirme seu e-mail para contratar.');
      return;
    }

    this.errorMessage.set(this.createSubscribeErrorMessage(error));
  }

  /**
   * A contratacao pode ter criado ou ligado o vinculo (item 7): "Ir para minha area" precisa enxergar. Com o celular
   * informado, rele a conta (o servidor so o guarda quando criou um vinculo novo).
   */
  private refreshMembershipAfterSubscribe(sentPhone: boolean): void {
    if (this.customerSessions.isAccountAuthenticated() && !this.customerSessions.currentCustomer()) {
      const companySlug = this.companyContextService.companySlug();
      this.customerSessions.forgetMembership(companySlug);
      this.customerSessions.ensureSession(companySlug).subscribe();
    }

    if (sentPhone) {
      this.customerSessions.reloadAccount().subscribe();
    }
  }

  private createSubscribeErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return error.error?.detail ?? 'Você já tem uma assinatura deste plano.';
    }

    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Entre novamente para contratar este plano.';
    }

    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'Plano não encontrado ou indisponível para contratação.';
    }

    // Celular recusado pelo servidor (vazio ou invalido): a mensagem dele, que fala do celular digitado.
    if (error instanceof HttpErrorResponse && error.status === 400 && this.needsPhone() && typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    return 'Não foi possível solicitar a assinatura agora.';
  }
}

/** Plano diferente com servico em comum: o texto fala com o cliente e so avisa. */
function describeOverlap(overlaps: readonly PublicSubscriptionPlanOverlap[]): string {
  const serviceNames = [...new Set(overlaps.flatMap((overlap) => overlap.serviceNames))];
  if (serviceNames.length === 0) {
    return '';
  }

  return overlaps.length === 1
    ? `Seu plano atual já cobre ${joinNames(serviceNames)}.`
    : `Seus planos atuais já cobrem ${joinNames(serviceNames)}.`;
}
