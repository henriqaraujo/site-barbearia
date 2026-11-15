import { HttpErrorResponse } from '@angular/common/http';
import { featureNotInPlanProblem } from '../../../core/models/company-plan.model';

export type AppointmentErrorResult =
  | { type: 'email-confirmation'; message: string }
  | { type: 'slot-unavailable'; message: string }
  | { type: 'price-changed'; message: string }
  | { type: 'conflict'; message: string }
  | { type: 'bad-request'; message: string }
  | { type: 'not-found'; message: string }
  | { type: 'generic'; message: string };

export type WaitlistErrorResult =
  | { type: 'email-confirmation'; message: string }
  | { type: 'not-in-plan'; message: string }
  | { type: 'conflict'; message: string }
  | { type: 'bad-request'; message: string }
  | { type: 'not-found'; message: string }
  | { type: 'generic'; message: string };

/** 403 com o codigo da regra 3: a tela mostra a mensagem e o "Reenviar link". */
export function isEmailConfirmationRequired(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 403 && error.error?.code === 'email-confirmation-required';
}

/**
 * Conflito para a conta sem vinculo pode ser o caso B do item 7 ("Fale com a empresa"): mostra o texto do servidor,
 * que e generico. Nos demais casos fica a mensagem da tela.
 */
export function conflictMessage(error: HttpErrorResponse, fallback: string, isAccountWithoutMembership: boolean): string {
  const detail = error.error?.detail;
  return isAccountWithoutMembership && typeof detail === 'string' && detail ? detail : fallback;
}

/** Analisa falhas de criacao de agendamento e classifica o tipo e a mensagem para o usuario. */
export function parseAppointmentError(error: unknown): AppointmentErrorResult {
  if (isEmailConfirmationRequired(error)) {
    return {
      type: 'email-confirmation',
      message: error.error?.detail ?? 'Confirme seu e-mail para agendar.'
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 409) {
    if (error.error?.code === 'slot-unavailable') {
      return {
        type: 'slot-unavailable',
        message: 'O horário selecionado não está mais disponível. Escolha outro horário.'
      };
    }

    if (error.error?.code === 'price-changed') {
      const detail = error.error?.detail;
      return {
        type: 'price-changed',
        message: typeof detail === 'string' && detail ? detail : 'O preço do serviço mudou. Confira e confirme de novo.'
      };
    }

    const detail = error.error?.detail;
    return {
      type: 'conflict',
      message: typeof detail === 'string' && detail ? detail : 'Não foi possível concluir o agendamento agora. Tente novamente em instantes.'
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return {
      type: 'bad-request',
      message: 'Revise os dados informados para confirmar o agendamento.'
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 404) {
    return {
      type: 'not-found',
      message: 'Serviço ou profissional não encontrado para este agendamento.'
    };
  }

  return {
    type: 'generic',
    message: 'Não foi possível confirmar o agendamento. Tente novamente em instantes.'
  };
}

/** Analisa falhas de criacao de fila de espera e classifica o tipo e a mensagem para o usuario. */
export function parseWaitlistError(error: unknown, isAccountWithoutMembership: boolean): WaitlistErrorResult {
  if (isEmailConfirmationRequired(error)) {
    return {
      type: 'email-confirmation',
      message: error.error?.detail ?? 'Confirme seu e-mail para agendar.'
    };
  }

  if (featureNotInPlanProblem(error)) {
    return {
      type: 'not-in-plan',
      message: 'A lista de espera não está disponível nesta empresa.'
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 409) {
    return {
      type: 'conflict',
      message: conflictMessage(error, 'Você já está na fila ou ainda há horário disponível para esta data.', isAccountWithoutMembership)
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return {
      type: 'bad-request',
      message: 'Revise seus dados para entrar na fila de espera.'
    };
  }

  if (error instanceof HttpErrorResponse && error.status === 404) {
    return {
      type: 'not-found',
      message: 'Serviço ou profissional não encontrado para esta fila.'
    };
  }

  return {
    type: 'generic',
    message: 'Não foi possível entrar na fila. Tente novamente em instantes.'
  };
}
