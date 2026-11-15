import { HttpErrorResponse } from '@angular/common/http';

const GENERIC_WAIT_MESSAGE = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';

/**
 * Mensagem para o 429 dos limites por IP da API; null quando o erro e outro. Nao revela nada sobre a conta: o
 * limite e do endereco de origem. O tempo vem do cabecalho Retry-After (o 429 da API nao tem corpo); sem ele,
 * ou quando o navegador nao consegue le-lo, a mensagem pede alguns minutos.
 */
export function tooManyAttemptsMessage(error: unknown): string | null {
  if (!isTooManyRequests(error)) {
    return null;
  }

  const retryAfterSeconds = retryAfterSecondsOf(error);
  if (retryAfterSeconds === null) {
    return GENERIC_WAIT_MESSAGE;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return minutes === 1
    ? 'Muitas tentativas seguidas. Aguarde 1 minuto e tente novamente.'
    : `Muitas tentativas seguidas. Aguarde ${minutes} minutos e tente novamente.`;
}

/**
 * Mensagem para o 429 das consultas ao provedor de pagamentos (atualizar agora e Pix, limite por usuario); null
 * quando o erro e outro. O tempo, em segundos, vem do Retry-After; sem ele, pede alguns segundos.
 */
export function tooManyQueriesMessage(error: unknown): string | null {
  if (!isTooManyRequests(error)) {
    return null;
  }

  const retryAfterSeconds = retryAfterSecondsOf(error);
  if (retryAfterSeconds === null) {
    return 'Muitas consultas seguidas. Tente de novo em alguns segundos.';
  }

  const seconds = Math.ceil(retryAfterSeconds);
  return `Muitas consultas seguidas. Tente de novo em ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}.`;
}

function isTooManyRequests(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 429;
}

function retryAfterSecondsOf(error: HttpErrorResponse): number | null {
  const seconds = Number(error.headers?.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
