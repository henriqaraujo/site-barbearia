import catalog from '../../../../shared/legal-documents.json';
import { environment } from '../../../environments/environment';

/** Documentos do catalogo compartilhado com o backend (aceitos no cadastro e listados nos links do rodape). */
type CatalogLegalDocumentId = 'termos' | 'privacidade';

export type LegalDocumentId = CatalogLegalDocumentId | 'termos-pagamento';

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  /** Data da versao (AAAA-MM-DD): e tambem o nome do arquivo do texto. */
  version: string;
  isDraft: boolean;
  /** Rota da pagina (/termos, /privacidade, /termos/pagamento). */
  path: string;
  /** Texto desta versao em public/assets/legal; versao nova e arquivo novo, os antigos nunca mudam. */
  contentUrl: string;
}

/** Termos e Politica de Privacidade, lidos de shared/legal-documents.json (a mesma fonte do backend). */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = (Object.keys(catalog.documents) as CatalogLegalDocumentId[]).map((id) => {
  const entry = catalog.documents[id];
  return {
    id,
    title: entry.title,
    version: entry.version,
    isDraft: entry.status === 'rascunho',
    path: `/${id}`,
    contentUrl: `/assets/legal/${id}-${entry.version}.html`
  };
});

/**
 * Termos de pagamento (conta de pagamentos Asaas da empresa): aceitos pelo dono no painel, nao no cadastro, por isso
 * ficam fora do catalogo compartilhado e dos links do rodape. A versao e a mesma de PaymentTerms.CurrentVersion no
 * backend (a API devolve a versao em vigor em terms.version); versao nova = arquivo novo e data nova nos dois lados.
 * A rota fica sob /termos, que ja e palavra reservada do slug.
 */
export const PAYMENT_TERMS_DOCUMENT: LegalDocument = {
  id: 'termos-pagamento',
  title: 'Termos de pagamento',
  version: '2026-10-15',
  isDraft: true,
  path: '/termos/pagamento',
  contentUrl: '/assets/legal/termos-pagamento-2026-10-15.html'
};

export function legalDocument(id: LegalDocumentId): LegalDocument {
  const document = [...LEGAL_DOCUMENTS, PAYMENT_TERMS_DOCUMENT].find((candidate) => candidate.id === id);
  if (!document) throw new Error(`Documento legal desconhecido: ${id}`);
  return document;
}

/**
 * Texto em rascunho (ainda nao revisado pelo advogado) nao aparece em producao: a pagina volta para a raiz e os links
 * somem. Fora de producao (DEV, QA) aparece com a faixa de rascunho.
 */
export function isLegalDocumentVisible(document: LegalDocument, production: boolean = environment.production): boolean {
  return !(production && document.isDraft);
}

export function visibleLegalDocuments(production: boolean = environment.production): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter((document) => isLegalDocumentVisible(document, production));
}

/** "2026-10-05" -> "05/10/2026". */
export function formatLegalVersion(version: string): string {
  const [year, month, day] = version.split('-');
  return `${day}/${month}/${year}`;
}
