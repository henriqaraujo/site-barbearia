export type PublicSubscriptionBillingPeriod = 'Monthly';
export type PublicCustomerSubscriptionStatus = 'AwaitingPayment' | 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Overdue';

export interface PublicSubscriptionPlan {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly billingPeriod: PublicSubscriptionBillingPeriod;
  readonly isFeatured: boolean;
  readonly displayOrder: number;
  /** Plano promocional: ultimo dia em que pode ser assinado (YYYY-MM-DD); null = sem data de fim. */
  readonly saleEndsOn?: string | null;
  /** Plano com "Profissionais escolhidos": quem atende por ele. */
  readonly professionalNames?: readonly string[] | null;
  readonly professionalId?: string | null;
  readonly professionalName?: string | null;
  readonly benefits: readonly PublicSubscriptionPlanBenefit[];
}

/** Plano que o cliente ja tem e que cobre servicos do plano do checkout (so aviso). */
export interface PublicSubscriptionPlanOverlap {
  readonly planName: string;
  readonly serviceNames: readonly string[];
}

export interface PublicSubscriptionPlanBenefit {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly quantityPerPeriod: number;
}

export interface PublicCustomerSubscription {
  readonly id: string;
  readonly subscriptionPlanId: string;
  readonly planName: string;
  readonly contractedPrice: number;
  readonly startDate: string;
  readonly nextRenewalDate: string;
  readonly status: PublicCustomerSubscriptionStatus;
}
