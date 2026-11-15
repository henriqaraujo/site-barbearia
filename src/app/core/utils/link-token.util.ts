import { Location } from '@angular/common';
import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Parametros de um link com token (redefinicao de senha, cancelamento da fila). O token vem no fragmento
 * (#token=...): o navegador nao o envia ao servidor nem no Referer. Links antigos com o token na query continuam
 * aceitos durante a transicao (valem minutos), e o fragmento tem prioridade quando os dois existem.
 */
export function readLinkParams(route: ActivatedRouteSnapshot): URLSearchParams {
  const fragmentParams = parseDecodedFragment(route.fragment ?? '');
  if (fragmentParams.has('token')) {
    return fragmentParams;
  }

  const queryParams = new URLSearchParams();
  route.queryParamMap.keys.forEach((key) => queryParams.set(key, route.queryParamMap.get(key) ?? ''));
  return queryParams;
}

/**
 * O Router entrega o fragmento ja decodificado (decodeURIComponent): "#token=abc%2B%2F" chega como "token=abc+/".
 * Passar isso de novo pelo URLSearchParams trocaria o "+" do token Base64 por espaco e o link deixaria de valer;
 * por isso os pares sao separados sem nova decodificacao.
 */
function parseDecodedFragment(fragment: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const pair of fragment.split('&').filter((part) => part.length > 0)) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex < 0) {
      params.append(pair, '');
    } else {
      params.append(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
    }
  }

  return params;
}

/** Tira query e fragmento da barra de endereco depois de ler o token, para ele nao ficar no historico. */
export function clearLinkSecrets(location: Location): void {
  const pathWithoutQuery = location.path(false).split('?')[0];
  location.replaceState(pathWithoutQuery);
}

/**
 * Mesmo link que o backend manda por e-mail (WaitlistCancellationLink), para mostrar a quem nao informou e-mail:
 * /{slug}/fila/cancelar#token=... (S10), com o token no fragmento.
 */
export function buildWaitlistCancellationUrl(origin: string, companySlug: string, token: string): string {
  return `${origin}/${encodeURIComponent(companySlug)}/fila/cancelar#${new URLSearchParams({ token }).toString()}`;
}
