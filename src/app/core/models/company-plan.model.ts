import { HttpErrorResponse } from '@angular/common/http';
import type { PlanBlockedAppointment, PlanBlockedProfessional, PlanChange } from './plan-change.model';

/** Situacao da empresa no plano da HL (GET /api/admin/plan). */
export type CompanyPlanStatus = 'Courtesy' | 'Trialing' | 'Active' | 'PastDue' | 'Cancelled';

export type CompanyPlanCycle = 'Monthly' | 'Annual';

/** Funcao do catalogo: liberada no plano atual e, se nao, o plano mais barato que libera (null = nenhum a venda). */
export interface CompanyPlanFeature {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  /** false: a funcao ainda nao existe (ex.: avisos por WhatsApp). */
  readonly available: boolean;
  readonly requiredPlan: string | null;
}

/** Limite do plano com o uso de hoje; max null = sem limite. */
export interface CompanyPlanLimit {
  readonly key: string;
  readonly name: string;
  readonly max: number | null;
  readonly current: number;
}

/** "Meu plano" (Back ID 16/17, B2): plano, ciclo, situacao, funcoes e limites da empresa do token. */
export interface CompanyPlan {
  readonly plan: { readonly id: string; readonly code: string; readonly name: string; readonly monthlyPrice: number; readonly annualPrice: number | null };
  readonly status: CompanyPlanStatus;
  readonly cycle: CompanyPlanCycle;
  /** false: a empresa ainda nao tem plano gravado e vale o do trial em cortesia, sem bloqueio. */
  readonly assigned: boolean;
  readonly features: readonly CompanyPlanFeature[];
  readonly limits: readonly CompanyPlanLimit[];
  /** Acesso pela situacao do pagamento (Back ID 20, B4); ausente em resposta antiga = liberado. */
  readonly access?: CompanyPlanAccess;
  /** Canal de suporte que a API manda junto (o mesmo do HL_SUPPORT_CONTACT). */
  readonly support?: { readonly email: string; readonly whatsapp: string };
  /** Troca de plano pendente (B7): upgrade esperando o pagamento ou downgrade/ciclo agendado. */
  readonly pendingChange?: PlanChange | null;
  /** Profissionais bloqueados pelo plano (B7), com a data em que serao removidos. */
  readonly blockedProfessionals?: readonly PlanBlockedProfessional[];
  /** Agendamentos futuros dos bloqueados e de quem o downgrade agendado vai bloquear (Back ID 24). */
  readonly blockedAppointments?: readonly PlanBlockedAppointment[];
}

/**
 * Full: liberado. PanelBlocked: painel bloqueado (402). SiteOff: tambem o site fora. Purgeable: igual ao SiteOff para a
 * empresa (para a plataforma, pode excluir).
 */
export type CompanyAccessState = 'Full' | 'PanelBlocked' | 'SiteOff' | 'Purgeable';

/** Datas em yyyy-MM-dd no fuso da empresa; cada campo so vem na situacao em que faz sentido. */
export interface CompanyPlanAccess {
  readonly state: CompanyAccessState;
  readonly stateSince?: string | null;
  readonly trialEndsOn?: string | null;
  /** So no trial, contando hoje (empresa nova = 15). */
  readonly trialDaysLeft?: number | null;
  readonly courtesyEndsOn?: string | null;
  readonly nextDueDate?: string | null;
  readonly pastDueSince?: string | null;
  readonly daysOverdue?: number | null;
  readonly panelBlocksOn?: string | null;
  readonly siteOffOn?: string | null;
  readonly purgeableOn?: string | null;
  /** Desbloqueio manual da plataforma vigente. */
  readonly unblockedUntil?: string | null;
  /** Link da fatura do plano (B5; por ora null). */
  readonly invoiceUrl?: string | null;
}

/** Estados em que o painel fica bloqueado. */
export const BLOCKED_ACCESS_STATES: readonly CompanyAccessState[] = ['PanelBlocked', 'SiteOff', 'Purgeable'];

export function isAccessBlocked(access: CompanyPlanAccess | null | undefined): boolean {
  return !!access && BLOCKED_ACCESS_STATES.includes(access.state);
}

/** Faixa do topo do painel: periodo de teste ou pagamento em atraso; null quando nao ha o que avisar. */
export interface PlanAccessNotice {
  readonly tone: 'info' | 'warning';
  readonly title: string;
  readonly detail: string;
  readonly invoiceUrl: string | null;
}

export function describePlanAccessNotice(plan: CompanyPlan | null): PlanAccessNotice | null {
  const access = plan?.access;
  if (!plan || !access || isAccessBlocked(access)) {
    return null;
  }

  if (plan.status === 'Trialing' && typeof access.trialDaysLeft === 'number') {
    const days = access.trialDaysLeft;
    const title = days <= 1 ? 'Período de teste: último dia' : `Período de teste: faltam ${days} dias`;
    return {
      tone: 'info',
      title,
      detail: access.trialEndsOn ? `O teste grátis vai até ${formatDayMonth(access.trialEndsOn)}.` : 'Aproveite o teste grátis.',
      invoiceUrl: access.invoiceUrl ?? null
    };
  }

  if (plan.status === 'PastDue') {
    const lastDay = access.panelBlocksOn ? addDays(access.panelBlocksOn, -1) : null;
    const title = access.unblockedUntil
      ? `Pagamento em atraso: o painel está liberado até ${formatDayMonth(access.unblockedUntil)}`
      : lastDay ? `Pagamento em atraso: regularize até ${formatDayMonth(lastDay)} para não bloquear` : 'Pagamento em atraso: regularize para não bloquear';
    const overdue = typeof access.daysOverdue === 'number' && access.daysOverdue > 0
      ? `${access.daysOverdue === 1 ? 'Há 1 dia' : `Há ${access.daysOverdue} dias`} em atraso. `
      : '';
    return {
      tone: 'warning',
      title,
      detail: `${overdue}Depois disso, o painel fica bloqueado até o pagamento; o site de agendamento continua no ar.`,
      invoiceUrl: access.invoiceUrl ?? null
    };
  }

  return null;
}

/**
 * Plano cancelado por estorno ou chargeback (Back ID 24): "Seu plano foi cancelado por estorno em dd/mm/aaaa. O site fica
 * no ar ate dd/mm/aaaa." O dia do estorno e o inicio do estado (stateSince); o site fica no ar ate a vespera do siteOffOn,
 * como na tela "Regularize" do ID 15. null quando o plano nao esta cancelado.
 */
export function describeRefundCancellation(plan: CompanyPlan | null): string | null {
  if (!plan || plan.status !== 'Cancelled') {
    return null;
  }

  const access = plan.access;
  const cancelledOn = access?.stateSince ?? access?.pastDueSince ?? null;
  const first = cancelledOn ? `Seu plano foi cancelado por estorno em ${formatFullDate(cancelledOn)}.` : 'Seu plano foi cancelado por estorno.';
  if (access?.state === 'SiteOff' || access?.state === 'Purgeable') {
    return `${first} O site de agendamento está fora do ar até uma nova assinatura.`;
  }

  return access?.siteOffOn ? `${first} O site fica no ar até ${formatFullDate(addDays(access.siteOffOn, -1))}.` : first;
}

/** Corpo do 402 plan-payment-required (painel bloqueado por falta de pagamento do plano). */
export interface PlanPaymentRequiredProblem {
  readonly detail: string;
  readonly accessState: CompanyAccessState;
  readonly pastDueSince: string | null;
  readonly daysOverdue: number | null;
  readonly siteOffOn: string | null;
  readonly invoiceUrl: string | null;
}

/** 402 plan-payment-required da API, ou null para qualquer outro erro. */
export function planPaymentRequiredProblem(error: unknown): PlanPaymentRequiredProblem | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 402 || error.error === null || typeof error.error !== 'object') {
    return null;
  }

  const body = error.error as Record<string, unknown>;
  if (body['code'] !== PLAN_ERROR_CODES.paymentRequired) {
    return null;
  }

  const text = (key: string): string | null => typeof body[key] === 'string' && body[key] ? body[key] as string : null;
  const accessState = text('accessState');
  return {
    detail: text('detail') ?? 'O painel está bloqueado por falta de pagamento do plano.',
    accessState: accessState && BLOCKED_ACCESS_STATES.includes(accessState as CompanyAccessState) ? accessState as CompanyAccessState : 'PanelBlocked',
    pastDueSince: text('pastDueSince'),
    daysOverdue: typeof body['daysOverdue'] === 'number' ? body['daysOverdue'] : null,
    siteOffOn: text('siteOffOn'),
    invoiceUrl: text('invoiceUrl')
  };
}

/** "2026-10-22" -> "22/10" (sem mudar o dia por fuso). */
export function formatDayMonth(value: string): string {
  const [, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}`;
}

/** "2026-10-22" -> "22/10/2026". */
export function formatFullDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Soma dias a uma data yyyy-MM-dd sem passar por fuso. */
export function addDays(value: string, days: number): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export const COMPANY_PLAN_STATUS_LABELS: Readonly<Record<CompanyPlanStatus, string>> = {
  Courtesy: 'Cortesia',
  Trialing: 'Período de teste',
  Active: 'Ativo',
  PastDue: 'Pagamento em atraso',
  Cancelled: 'Cancelado'
};

export const COMPANY_PLAN_CYCLE_LABELS: Readonly<Record<CompanyPlanCycle, string>> = {
  Monthly: 'Mensal',
  Annual: 'Anual'
};

/** Codigos dos erros de plano da API. */
export const PLAN_ERROR_CODES = {
  featureNotInPlan: 'feature-not-in-plan',
  limitReached: 'plan-limit-reached',
  /** 402: painel bloqueado por falta de pagamento do plano (B4). */
  paymentRequired: 'plan-payment-required'
} as const;

/** Tela "Regularize para continuar", fora do layout do painel (como o primeiro acesso). */
export const PLAN_BLOCKED_ROUTE = '/admin/regularizar';

/** Rota de "Meu plano" e o parametro que destaca a funcao pedida (?funcao=club). */
export const MY_PLAN_ROUTE = '/admin/meu-plano';
export const MY_PLAN_FEATURE_QUERY_PARAM = 'funcao';
/** Aba do Meu plano na URL (ID 44): ?aba=faturas abre direto as faturas (e-mails e avisos apontam para ela). */
export const MY_PLAN_TAB_QUERY_PARAM = 'aba';
export const MY_PLAN_INVOICES_TAB = 'faturas';
/** ?aba=informacoes abre a aba "Informacoes do plano" (ID 48). */
export const MY_PLAN_INFO_TAB = 'informacoes';

/** Telas do painel por funcao do plano (mapa do Back, ID 16). Prefixo: a rota e as de baixo dela. */
export const ADMIN_ROUTE_FEATURES: readonly { readonly route: string; readonly feature: string }[] = [
  { route: '/admin/fila-espera', feature: 'booking.waitlist' },
  { route: '/admin/retencao', feature: 'retention' },
  { route: '/admin/produtos', feature: 'products' },
  { route: '/admin/fornecedores', feature: 'products' },
  { route: '/admin/compras', feature: 'products' },
  { route: '/admin/financeiro', feature: 'finance' },
  { route: '/admin/movimentacoes', feature: 'finance' },
  { route: '/admin/contas', feature: 'finance' },
  { route: '/admin/despesas-recorrentes', feature: 'finance' },
  { route: '/admin/comissoes', feature: 'commissions' },
  { route: '/admin/estornos-de-comissao', feature: 'commissions' },
  { route: '/admin/relatorios', feature: 'reports' },
  { route: '/admin/horarios-de-pico', feature: 'reports' },
  { route: '/admin/assinaturas', feature: 'club' },
  { route: '/admin/fidelidade', feature: 'loyalty' },
  { route: '/admin/pagamentos/cobrancas', feature: 'online-payments' }
];

/** Funcao do plano da tela do painel (o alias /painel conta como /admin); null = tela de todos os planos. */
export function featureForAdminUrl(url: string): string | null {
  const path = url.split(/[?#]/)[0].replace(/^\/painel(?=\/|$)/, '/admin');
  return ADMIN_ROUTE_FEATURES.find(({ route }) => path === route || path.startsWith(`${route}/`))?.feature ?? null;
}

/** Corpo do 403 feature-not-in-plan. */
export interface FeatureNotInPlanProblem {
  readonly detail: string;
  readonly feature: string;
  readonly featureName: string;
  readonly currentPlan: string | null;
  readonly requiredPlan: string | null;
}

/** 403 "Fora do plano" da API, ou null para qualquer outro erro. */
export function featureNotInPlanProblem(error: unknown): FeatureNotInPlanProblem | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403 || error.error === null || typeof error.error !== 'object') {
    return null;
  }

  const body = error.error as Record<string, unknown>;
  if (body['code'] !== PLAN_ERROR_CODES.featureNotInPlan || typeof body['feature'] !== 'string') {
    return null;
  }

  const featureName = typeof body['featureName'] === 'string' ? body['featureName'] : body['feature'];
  const requiredPlan = typeof body['requiredPlan'] === 'string' ? body['requiredPlan'] : null;
  return {
    feature: body['feature'],
    featureName,
    currentPlan: typeof body['currentPlan'] === 'string' ? body['currentPlan'] : null,
    requiredPlan,
    detail: typeof body['detail'] === 'string' && body['detail'] ? body['detail'] : `${featureName} não faz parte do seu plano.${availableInPlanText(requiredPlan)}`
  };
}

/** 409 plan-limit-reached (ex.: profissionais ativos). */
export function isPlanLimitReached(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409 && (error.error as { code?: unknown } | null)?.code === PLAN_ERROR_CODES.limitReached;
}

/** " Disponível no plano X." quando algum plano libera; senao, vazio. */
export function availableInPlanText(requiredPlan: string | null): string {
  return requiredPlan ? ` Disponível no plano ${requiredPlan}.` : '';
}
