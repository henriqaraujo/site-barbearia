import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PLATFORM_BRAND } from '../../core/constants/platform-brand.constants';
import { LegalDocumentId, formatLegalVersion, legalDocument } from '../../core/legal/legal-documents';
import { LegalLinksComponent } from '../../shared/components/legal-links/legal-links.component';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Pagina de um documento legal (/termos, /privacidade) com a versao atual de shared/legal-documents.json. O texto vem
 * do arquivo daquela versao em public/assets/legal; em rascunho a pagina mostra a faixa "revisar com advogado".
 */
@Component({
  selector: 'app-legal-document-page',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent],
  templateUrl: './legal-document-page.component.html',
  styleUrl: './legal-document-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O texto entra por innerHTML; os estilos ficam todos sob .legal-page (ver o .scss).
  encapsulation: ViewEncapsulation.None
})
export class LegalDocumentPageComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly brand = PLATFORM_BRAND;
  readonly document = legalDocument(inject(ActivatedRoute).snapshot.data['document'] as LegalDocumentId);
  readonly versionDate = formatLegalVersion(this.document.version);
  readonly state = signal<LoadState>('loading');
  readonly content = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.http
      .get(this.document.contentUrl, { responseType: 'text' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (text) => {
          this.content.set(text);
          this.state.set('ready');
        },
        error: () => this.state.set('error')
      });
  }
}
