/**
 * Termo do negocio nos textos da interface. O HL Gestao atende empresas de varios segmentos, entao nenhum texto
 * escreve o segmento (ex.: "barbearia") direto: usa este termo. Codigo, banco e rotas nao mudam (continuam com
 * company/barber nos nomes). "Empresa" e feminino como "barbearia": artigos e contracoes ("da", "na", "sua") seguem
 * iguais nos textos.
 */
export const UI_TERMS = {
  company: 'empresa',
  companies: 'empresas',
  Company: 'Empresa'
} as const;
