// QA: mesmo modelo de dominio unico do development/staging. O frontend e a API ficam no mesmo host
// (localmente em http://localhost:8181, externamente em https://qa.gestaohl.com.br pelo Cloudflare Tunnel),
// e o Nginx do container faz proxy de /api/ para a API do proprio ambiente — por isso apiBaseUrl e relativo.
export const environment = {
  production: false,
  apiBaseUrl: '',
  timeZoneId: 'America/Sao_Paulo',
  presentationMock: false
} as const;
