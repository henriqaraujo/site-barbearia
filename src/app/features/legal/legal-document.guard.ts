import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LegalDocumentId, isLegalDocumentVisible, legalDocument } from '../../core/legal/legal-documents';

/** Documento em rascunho em producao: a pagina nao existe para o publico e volta para a raiz. */
export const legalDocumentGuard: CanActivateFn = (route) => {
  const id = route.data['document'] as LegalDocumentId;
  return isLegalDocumentVisible(legalDocument(id)) || inject(Router).createUrlTree(['/']);
};
