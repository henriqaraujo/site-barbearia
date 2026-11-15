import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Troca a imagem por um substituto quando o arquivo nao carrega. Arquivo ausente no storage
 * (upload antigo, midia removida) deixava o <img> quebrado na tela publica e no painel: o
 * template so checava se a URL existia, nunca se ela resolvia.
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true,
  host: {
    '(error)': 'handleError()'
  }
})
export class ImageFallbackDirective {
  private readonly imageElement = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private hasFallenBack = false;

  /** URL usada quando a original falha. Vazio esconde a imagem. */
  readonly appImageFallback = input('');

  handleError(): void {
    if (this.hasFallenBack) {
      return;
    }

    this.hasFallenBack = true;
    const fallbackUrl = this.appImageFallback();
    const element = this.imageElement.nativeElement;

    if (fallbackUrl) {
      element.src = fallbackUrl;
      return;
    }

    element.style.display = 'none';
    element.dataset['imageFallbackHidden'] = 'true';
  }
}
