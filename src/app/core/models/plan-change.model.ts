import { HttpErrorResponse } from '@angular/common/http';
import { CompanyPlanCycle } from './company-plan.model';
import { PlatformInvoice } from './platform-invoice.model';

/**
 * Tipo da troca do plano da HL (Back ID 23, B7). Upgrade vale ao pagar o proporcional; Downgrade e CycleChange valem no
 * proximo vencimento; Subscribe e a empresa sem plano pago (usar o subscribe do B5).
 */
export type PlanChangeKind = 'Upgrade' | 'Downgrade' | 'CycleChange' | 'Subscribe';

/** AwaitingPayment: upgrade com fatura; Scheduled: downgrade ou ciclo; Applied: upgrade de valor zero, ja valeu. */
export type PlanChangeStatus = 'AwaitingPayment' | 'Scheduled' | 'Applied';

/** Profissional ativo que pode ficar no plano novo, com os agendamentos futuros dele. */
export interface PlanProfessionalOption {
  readonly id: string;
  readonly name: string;
  readonly futureAppointments: number;
}

/** Cobrancas e assinaturas online abertas que impedem perder a cobranca online. */
export interface OnlinePaymentsInUse {
  readonly openCharges: number;
  readonly onlineSubscriptions: number;
}

export interface PlanChangeRequest {
  readonly planId: string;
  readonly cycle: CompanyPlanCycle;
  /** Quem fica ativo quando o plano novo tem limite menor que os ativos; null quando nao precisa. */
  readonly keepProfessionalIds: readonly string[] | null;
}

/** POST /api/admin/plan/preview: o que a troca faria, sem gravar nada. Datas yyyy-MM-dd. */
export interface PlanChangePreview {
  readonly kind: PlanChangeKind;
  readonly planId: string;
  readonly planName: string;
  readonly cycle: CompanyPlanCycle;
  readonly price: number;
  readonly prorationAmount: number;
  readonly chargeable: boolean;
  /** Upgrade: null (vale ao pagar). Downgrade e ciclo: o proximo vencimento. */
  readonly effectiveOn: string | null;
  readonly limit: number | null;
  readonly activeProfessionals: number;
  readonly requiresSelection: boolean;
  readonly professionals: readonly PlanProfessionalOption[];
  /** Data em que os nao escolhidos sao removidos definitivamente (anonimizados). */
  readonly anonymizeOn: string | null;
  readonly professionalsToUnblock: number;
  readonly onlinePaymentsInUse: OnlinePaymentsInUse | null;
  /** B7/ID 24: agendamentos futuros de quem fica bloqueado (com keepProfessionalIds, so os dos nao escolhidos). */
  readonly appointments?: readonly PlanBlockedAppointment[];
}

/** Troca pedida (resposta do change e o pendingChange do GET /api/admin/plan). */
export interface PlanChange {
  readonly id: string;
  readonly kind: PlanChangeKind;
  readonly status: PlanChangeStatus;
  readonly toPlanId: string;
  readonly toPlanName: string;
  readonly toCycle: CompanyPlanCycle;
  readonly effectiveOn: string | null;
  readonly prorationAmount: number;
  readonly invoice: PlatformInvoice | null;
  readonly keepProfessionalIds: readonly string[] | null;
}

/** Profissional bloqueado pelo plano (GET /api/admin/plan, blockedProfessionals). */
export interface PlanBlockedProfessional {
  readonly id: string;
  readonly name: string;
  readonly blockedAt: string;
  readonly anonymizeOn: string;
  readonly futureAppointments: number;
}

/** O que a escolha de profissionais precisa (vem da previa ou do 409 professionals-selection-required). */
export interface ProfessionalSelectionRequest {
  readonly limit: number;
  readonly professionals: readonly PlanProfessionalOption[];
  readonly anonymizeOn: string | null;
}

export const PLAN_CHANGE_ERROR_CODES = {
  selectionRequired: 'professionals-selection-required',
  onlinePaymentsOpen: 'online-payments-open',
  changePending: 'plan-change-pending',
  planNotActive: 'platform-plan-not-active',
  nothing: 'plan-change-nothing'
} as const;

export const PLAN_CHANGE_KIND_LABELS: Readonly<Record<PlanChangeKind, string>> = {
  Upgrade: 'Upgrade',
  Downgrade: 'Downgrade',
  CycleChange: 'Troca de ciclo',
  Subscribe: 'Assinatura'
};

/** Corpo do 409 professionals-selection-required, ou null para qualquer outro erro. */
export function professionalSelectionProblem(error: unknown): ProfessionalSelectionRequest | null {
  const body = problemBody(error, 409);
  if (!body || body['code'] !== PLAN_CHANGE_ERROR_CODES.selectionRequired) {
    return null;
  }

  return {
    limit: typeof body['limit'] === 'number' ? body['limit'] : 0,
    professionals: Array.isArray(body['professionals']) ? body['professionals'] as PlanProfessionalOption[] : [],
    anonymizeOn: typeof body['anonymizeOn'] === 'string' ? body['anonymizeOn'] : null
  };
}

/** Corpo do 409 online-payments-open, ou null para qualquer outro erro. */
export function onlinePaymentsOpenProblem(error: unknown): OnlinePaymentsInUse | null {
  const body = problemBody(error, 409);
  if (!body || body['code'] !== PLAN_CHANGE_ERROR_CODES.onlinePaymentsOpen) {
    return null;
  }

  return {
    openCharges: typeof body['openCharges'] === 'number' ? body['openCharges'] : 0,
    onlineSubscriptions: typeof body['onlineSubscriptions'] === 'number' ? body['onlineSubscriptions'] : 0
  };
}

/** "1 cobrança online aberta e 2 assinaturas online": o que impede perder a cobranca online. */
export function describeOnlinePaymentsInUse(inUse: OnlinePaymentsInUse): string {
  const parts: string[] = [];
  if (inUse.openCharges > 0) {
    parts.push(inUse.openCharges === 1 ? '1 cobrança online aberta' : `${inUse.openCharges} cobranças online abertas`);
  }

  if (inUse.onlineSubscriptions > 0) {
    parts.push(inUse.onlineSubscriptions === 1 ? '1 assinatura do clube cobrada online' : `${inUse.onlineSubscriptions} assinaturas do clube cobradas online`);
  }

  return parts.join(' e ');
}

function problemBody(error: unknown, status: number): Record<string, unknown> | null {
  return error instanceof HttpErrorResponse && error.status === status && error.error !== null && typeof error.error === 'object'
    ? error.error as Record<string, unknown>
    : null;
}

/** Agendamento futuro de profissional bloqueado (ou que o downgrade agendado vai bloquear), Back ID 24. */
export interface PlanBlockedAppointment {
  readonly id: string;
  readonly professionalId: string;
  readonly professionalName: string;
  /** yyyy-MM-dd */
  readonly date: string;
  /** HH:mm:ss */
  readonly startTime: string;
  readonly endTime: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly customerFirstName: string;
  readonly usesSubscription: boolean;
}

/** Passar agendamentos para outro profissional: os escolhidos ou todos de um profissional (nunca os dois). */
export type AppointmentTransferRequest =
  | { readonly toProfessionalId: string; readonly appointmentIds: readonly string[] }
  | { readonly toProfessionalId: string; readonly fromProfessionalId: string };

export type AppointmentTransferFailureCode = 'slot-unavailable' | 'service-not-offered' | 'not-eligible' | 'rejected';

export interface AppointmentTransferFailure {
  readonly appointmentId: string;
  readonly code: AppointmentTransferFailureCode | string;
  /** Mensagem da regra (ex.: "O profissional escolhido nao faz o servico Coloracao."). */
  readonly reason: string;
}

/** Aviso ao cliente do agendamento transferido (Back ID 28): Obsolete nao aparece na hora. */
export type CustomerNotificationStatus = 'Sent' | 'NoChannel' | 'Failed' | 'Obsolete';

export interface AppointmentTransferNotification {
  readonly appointmentId: string;
  readonly status: CustomerNotificationStatus | string;
  /** Canal que entregou (ex.: "Email"); null sem canal. */
  readonly channel: string | null;
}

export interface AppointmentTransferResult {
  readonly transferred: readonly string[];
  readonly failed: readonly AppointmentTransferFailure[];
  /** Back ID 28: se o cliente de cada transferido foi avisado; ausente em resposta antiga. */
  readonly notifications?: readonly AppointmentTransferNotification[];
}

/** Texto do aviso ao cliente, com os textos sugeridos pelo Back; null quando nao ha o que mostrar. */
export function describeCustomerNotification(notification: AppointmentTransferNotification | undefined): string | null {
  switch (notification?.status) {
    case 'Sent':
      return notification.channel === 'WhatsApp' ? 'Cliente avisado por WhatsApp' : 'Cliente avisado por e-mail';
    case 'NoChannel':
      return 'Cliente sem e-mail: avise por telefone';
    case 'Failed':
      return 'Não conseguimos avisar agora; tentaremos de novo';
    default:
      return null;
  }
}

export const APPOINTMENT_TRANSFER_ERROR_CODES = {
  allFailed: 'appointments-transfer-failed',
  targetUnavailable: 'transfer-target-unavailable'
} as const;

/** Por que um agendamento nao passou, em texto claro (o reason da API vem junto). */
export const APPOINTMENT_TRANSFER_FAILURE_LABELS: Readonly<Record<AppointmentTransferFailureCode, string>> = {
  'slot-unavailable': 'Horário ocupado ou fora do expediente de quem recebe',
  'service-not-offered': 'Quem recebe não faz este serviço',
  'not-eligible': 'Este agendamento não pode ser passado por aqui',
  rejected: 'A agenda recusou a troca'
};

/** 409 appointments-transfer-failed: nenhum passou; devolve os motivos (ou null para outro erro). */
export function appointmentsTransferFailedProblem(error: unknown): readonly AppointmentTransferFailure[] | null {
  const body = problemBody(error, 409);
  if (!body || body['code'] !== APPOINTMENT_TRANSFER_ERROR_CODES.allFailed) {
    return null;
  }

  return Array.isArray(body['failed']) ? body['failed'] as AppointmentTransferFailure[] : [];
}
