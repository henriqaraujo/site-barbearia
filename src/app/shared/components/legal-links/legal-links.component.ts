import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { visibleLegalDocuments } from '../../../core/legal/legal-documents';

/**
 * Links para os Termos e a Politica de Privacidade (rodape da empresa, raiz, login e cadastro). Em producao, enquanto o
 * texto estiver em rascunho, o link nao aparece; sem nenhum documento visivel, nada e desenhado.
 */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (documents.length) {
      <nav class="legal-links" aria-label="Documentos legais">
        @for (document of documents; track document.id) {
          <a class="legal-links__link" [routerLink]="document.path">{{ document.title }}</a>
        }
      </nav>
    }
  `,
  styles: `
    .legal-links {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 0.875rem;
    }

    .legal-links__link {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .legal-links__link:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalLinksComponent {
  readonly documents = visibleLegalDocuments();
}
