// Producao usa o mesmo modelo de dominio unico dos demais ambientes: frontend e API no mesmo host
// (https://gestaohl.com.br), com o Nginx fazendo proxy de /api/ — por isso apiBaseUrl e relativo.
export const environment = {
  production: true,
  apiBaseUrl: '',
  timeZoneId: 'America/Sao_Paulo',
  presentationMock: false
} as const;