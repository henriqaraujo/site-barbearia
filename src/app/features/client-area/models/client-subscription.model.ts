export type ClientSubscriptionStatus = 'AwaitingPayment' | 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Overdue';

export type ClientSubscriptionSource = 'Admin' | 'Public';

export type ClientSubscriptionBillingPeriod = 'Monthly';

export interface ClientSubscriptionDetails {
  id: string;
  subscriptionPlanId: string;
  planName: string;
  planDescription: string | null;
  billingPeriod: ClientSubscriptionBillingPeriod;
  professionalId: string | null;
  professionalName: string | null;
  contractedPrice: number;
  startDate: string;
  nextRenewalDate: string;
  status: ClientSubscriptionStatus;
  source: ClientSubscriptionSource;
  currentPeriod: ClientSubscriptionPeriod | null;
  /** Plano promocional: ultimo dia coberto (YYYY-MM-DD); depois dele o plano nao renova. Null = sem data de fim. */
  coveredUntil?: string | null;
  /** Mensalidade em atraso mais antiga (YYYY-MM-DD, N16): os horarios novos saem como avulso ate o pagamento. */
  overdueInstallmentDate?: string | null;
  /** Sem responsavel e com "Profissionais escolhidos": quem atende o plano. */
  planProfessionalNames?: string[] | null;
}

export interface ClientSubscriptionPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: 'Open' | 'Closed';
  benefits: ClientSubscriptionBenefit[];
}

export interface ClientSubscriptionBenefit {
  serviceId: string;
  serviceName: string;
  allowedQuantity: number;
  reservedQuantity: number;
  usedQuantity: number;
  availableQuantity: number;
}
