import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

/**
 * Trava a rolagem da pagina enquanto houver drawer ou modal aberto, para rolar so o conteudo do overlay.
 *
 * Quem rola no painel e no site e a janela (o `html`): o `body` nao tem altura propria e o layout do admin nao tem
 * contêiner com rolagem. Por isso a trava e `overflow: hidden` no `html`. Tem contador: drawer + confirmacao por cima
 * so liberam a rolagem quando o ultimo fecha. A largura da barra de rolagem e devolvida como `padding-right` no `html`
 * para a pagina de tras nao dar um pulo ao abrir e fechar (barra sobreposta, como no celular, tem largura 0: nada a compensar).
 */
@Injectable({ providedIn: 'root' })
export class ScrollLockService {
  private readonly document = inject(DOCUMENT);
  private count = 0;
  private saved: { overflow: string; paddingRight: string } | null = null;

  /** Quantos overlays estao segurando a trava agora. */
  get lockCount(): number {
    return this.count;
  }

  /** Pega a trava; devolve a funcao que a solta (pode ser chamada mais de uma vez: so conta uma). */
  lock(): () => void {
    this.acquire();
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.release();
      }
    };
  }

  /** Pega a trava agora e solta quando o componente (ou servico) que chamou for destruido. Chamar em contexto de injecao. */
  lockUntilDestroyed(destroyRef: DestroyRef = inject(DestroyRef)): () => void {
    const release = this.lock();
    destroyRef.onDestroy(release);
    return release;
  }

  private acquire(): void {
    if (this.count++ > 0) {
      return;
    }

    const root = this.document.documentElement;
    const view = this.document.defaultView;
    const scrollbarWidth = view ? Math.max(0, view.innerWidth - root.clientWidth) : 0;
    this.saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    if (scrollbarWidth > 0) {
      const current = parseFloat(view?.getComputedStyle(root).paddingRight ?? '0') || 0;
      root.style.paddingRight = `${current + scrollbarWidth}px`;
    }

    root.style.overflow = 'hidden';
  }

  private release(): void {
    if (this.count === 0 || --this.count > 0) {
      return;
    }

    const root = this.document.documentElement;
    root.style.overflow = this.saved?.overflow ?? '';
    root.style.paddingRight = this.saved?.paddingRight ?? '';
    this.saved = null;
  }
}
