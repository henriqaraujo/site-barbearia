import { HttpErrorResponse } from '@angular/common/http';
import { CompanyPlanCycle } from './company-plan.model';

/** Situacao da fatura do plano da HL (B5). */
export type PlatformInvoiceStatus = 'Pending' | 'Overdue' | 'Paid' | 'Refunded' | 'Cancelled';

/**
 * Fatura do plano da HL cobrada pela conta Asaas da HL (Back ID 21). Mesmo item no painel (GET /api/admin/plan/invoices)
 * e na plataforma (com companyName). Datas yyyy-MM-dd.
 */
export interface PlatformInvoice {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string | null;
  readonly planName: string;
  readonly cycle: CompanyPlanCycle;
  readonly kind: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly amount: number;
  readonly netAmount: number | null;
  readonly dueDate: string;
  readonly status: PlatformInvoiceStatus;
  readonly paidOn: string | null;
  readonly paidBillingType: string | null;
  readonly estimatedCreditDate: string | null;
  readonly invoiceUrl: string | null;
  /** Back ID 45: forma atual (Undefined = quem paga escolhe no Asaas; null so em fatura fechada sem o dado). */
  readonly billingType?: PlanBillingType | null;
  /** Fatura aberta com forma Undefined ou a propria; nao diz se a conta do Asaas tem o meio habilitado. */
  readonly pixAvailable?: boolean;
  readonly boletoAvailable?: boolean;
}

/** Boleto da fatura em aberto (GET /api/admin/plan/invoices/{id}/boleto, Back ID 45). */
export interface PlatformInvoiceBoleto {
  /** Linha digitavel. */
  readonly identificationField: string;
  readonly barCode: string;
  /** PDF do boleto no Asaas. */
  readonly bankSlipUrl: string | null;
  readonly dueDate: string;
}

/** Filtros do historico (GET /api/admin/plan/invoices?status=&from=&to=&page=&pageSize=, Back ID 45). */
export interface PlatformInvoiceQuery {
  readonly status?: PlatformInvoiceStatus | '';
  /** Vencimento de/ate, AAAA-MM-DD. */
  readonly from?: string;
  readonly to?: string;
  readonly page: number;
  readonly pageSize: number;
}

/** Pix da fatura em aberto (GET /api/admin/plan/invoices/{id}/pix). */
export interface PlatformInvoicePix {
  readonly payload: string;
  /** PNG em base64. */
  readonly encodedImage: string;
}

/** Opcao de plano para assinar (GET /api/admin/plan/options). */
export interface PlanOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly monthlyPrice: number;
  readonly annualPrice: number | null;
  readonly features: readonly string[];
  readonly limits: readonly { readonly key: string; readonly max: number | null }[];
  readonly current: boolean;
}

/** Forma de pagamento da fatura do plano (Back ID 42); Undefined deixa quem paga escolher na pagina do Asaas. */
export type PlanBillingType = 'Undefined' | 'Pix' | 'Boleto' | 'CreditCard';

export const PLAN_BILLING_TYPE_LABELS: Readonly<Record<PlanBillingType, string>> = {
  Undefined: 'Deixar o cliente escolher no Asaas',
  Pix: 'Pix',
  Boleto: 'Boleto',
  CreditCard: 'Cartão de crédito'
};

export interface PlanSubscribeRequest {
  readonly planId: string;
  readonly cycle: CompanyPlanCycle;
  /** B7: quem fica ativo quando o plano escolhido tem limite menor que os ativos (409 professionals-selection-required). */
  readonly keepProfessionalIds?: readonly string[] | null;
  /** Padrao Undefined; forma que a conta da HL nao aceita volta 400 em errors.BillingType. */
  readonly billingType?: PlanBillingType;
}

export interface PlanSubscribeResponse {
  readonly invoice: PlatformInvoice;
}

export const PLATFORM_INVOICE_STATUS_LABELS: Readonly<Record<PlatformInvoiceStatus, string>> = {
  Pending: 'Em aberto',
  Overdue: 'Vencida',
  Paid: 'Paga',
  Refunded: 'Estornada',
  Cancelled: 'Cancelada'
};

export const PLATFORM_INVOICE_STATUS_TONES: Readonly<Record<PlatformInvoiceStatus, 'neutral' | 'warning' | 'success' | 'danger'>> = {
  Pending: 'warning',
  Overdue: 'danger',
  Paid: 'success',
  Refunded: 'neutral',
  Cancelled: 'neutral'
};

/** Codigos dos erros da cobranca do plano (Back ID 21). */
export const PLAN_BILLING_ERROR_CODES = {
  legalDataRequired: 'legal-data-required',
  billingUnavailable: 'platform-billing-unavailable',
  planChangeNotAvailable: 'platform-plan-change-not-available',
  invoiceNotOpen: 'invoice-not-open',
  boletoUnavailable: 'invoice-boleto-unavailable'
} as const;

/** Fatura que ainda pode ser paga (em aberto ou vencida). */
export function isInvoiceOpen(invoice: PlatformInvoice): boolean {
  return invoice.status === 'Pending' || invoice.status === 'Overdue';
}

/** A fatura aberta mais antiga (a que o Meu plano manda pagar primeiro); null sem nenhuma. */
export function oldestOpenInvoice(invoices: readonly PlatformInvoice[]): PlatformInvoice | null {
  return invoices.filter(isInvoiceOpen).reduce<PlatformInvoice | null>(
    (oldest, invoice) => !oldest || invoice.dueDate < oldest.dueDate ? invoice : oldest,
    null
  );
}

/** Meses gratis do anual frente a 12 mensais ("2 meses grátis" no cadastro inicial); 0 quando nao ha desconto. */
export function annualFreeMonths(monthlyPrice: number, annualPrice: number | null): number {
  if (annualPrice === null || monthlyPrice <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(12 - annualPrice / monthlyPrice));
}

/** Codigo do ProblemDetails (code) de um erro da API; null para os demais. */
export function apiProblemCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.error === null || typeof error.error !== 'object') {
    return null;
  }

  const code: unknown = (error.error as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : null;
}
