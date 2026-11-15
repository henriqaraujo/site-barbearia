import { HttpErrorResponse } from '@angular/common/http';
import { tooManyAttemptsMessage } from './rate-limit-message.util';

/**
 * Mensagem para a tela a partir do ProblemDetails da API: a primeira mensagem de validacao (errors), senao o detail
 * (regra de dominio). Qualquer outro erro, inclusive 5xx, usa o texto generico de quem chamou.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const rateLimited = tooManyAttemptsMessage(error);
  if (rateLimited) {
    return rateLimited;
  }

  if (!(error instanceof HttpErrorResponse) || error.status < 400 || error.status >= 500) {
    return fallback;
  }

  const body: unknown = error.error;
  if (body === null || typeof body !== 'object') {
    return fallback;
  }

  if ('errors' in body && body.errors !== null && typeof body.errors === 'object') {
    const firstMessage = Object.values(body.errors).flat().find((message): message is string => typeof message === 'string' && message.length > 0);
    if (firstMessage) {
      return firstMessage;
    }
  }

  return 'detail' in body && typeof body.detail === 'string' && body.detail ? body.detail : fallback;
}
