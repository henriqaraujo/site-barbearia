const PLATFORM_API_PATTERN = /\/api\/platform\//;
const PLATFORM_LOGIN_PATTERN = /\/api\/platform\/auth\/login(\?|$)/;
const PLATFORM_SESSION_PATTERN = /\/api\/platform\/auth\/(login|refresh|logout)(\?|$)/;

/** Identifica requests destinadas a area global da plataforma, isoladas do fluxo tenant. */
export function isPlatformApiUrl(url: string): boolean {
  return PLATFORM_API_PATTERN.test(url);
}

/** Identifica o endpoint de login Platform, que nao deve receber token nem disparar logout automatico. */
export function isPlatformLoginUrl(url: string): boolean {
  return PLATFORM_LOGIN_PATTERN.test(url);
}

/**
 * Rotas de sessao (login, refresh e logout): nenhuma delas pode disparar um refresh automatico em 401,
 * sob pena de laco infinito, e todas dependem do cookie e nao do access token.
 */
export function isPlatformSessionUrl(url: string): boolean {
  return PLATFORM_SESSION_PATTERN.test(url);
}
