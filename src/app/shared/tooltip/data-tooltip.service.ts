import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const MARGIN = 8;
const GAP = 8;
const ARROW_EDGE = 12;

/**
 * Dica de [data-tooltip] desenhada num unico elemento preso ao body (position: fixed), em vez de um pseudo-elemento
 * dentro do botao. O pseudo-elemento era cortado pelo overflow da tabela/cartao e pela borda da tela, e como o texto
 * ficava em uma linha so, as dicas longas (ex.: o motivo de uma acao desabilitada) saiam truncadas. Aqui a dica
 * quebra o texto, vira para cima quando falta espaco embaixo e e empurrada para dentro da tela quando falta nas laterais.
 * Em toque, o toque no elemento dispara o mouseover emulado e a dica aparece; tocar fora ou rolar a fecha.
 */
@Injectable({ providedIn: 'root' })
export class DataTooltipService {
  private readonly document = inject(DOCUMENT);
  private started = false;
  private bubble: HTMLElement | null = null;
  private arrow: HTMLElement | null = null;
  private host: Element | null = null;

  /** Liga os ouvintes uma unica vez (chamado pelo AppComponent). */
  start(): void {
    const win = this.document.defaultView;
    if (this.started || !win) {
      return;
    }
    this.started = true;
    const doc = this.document;
    doc.addEventListener('mouseover', (event) => this.onOver(event.target), true);
    doc.addEventListener('mouseout', (event) => this.onOut(event as MouseEvent), true);
    doc.addEventListener('focusin', (event) => this.onFocus(event.target), true);
    doc.addEventListener('focusout', () => this.hide(), true);
    doc.addEventListener('touchstart', (event) => this.onTouch(event.target), { capture: true, passive: true });
    doc.addEventListener('keydown', (event) => (event as KeyboardEvent).key === 'Escape' && this.hide(), true);
    doc.addEventListener('scroll', () => this.hide(), true);
    win.addEventListener('resize', () => this.hide());
  }

  /** Mostra a dica de um elemento (publico para os testes). */
  show(host: Element): void {
    const text = host.getAttribute('data-tooltip');
    if (!text) {
      this.hide();
      return;
    }
    const bubble = this.ensureBubble();
    this.host = host;
    bubble.firstChild!.textContent = text;
    bubble.style.left = '0px';
    bubble.style.top = '0px';
    bubble.classList.add('app-tooltip--visible');
    this.place(host, bubble);
  }

  hide(): void {
    this.host = null;
    this.bubble?.classList.remove('app-tooltip--visible');
  }

  private place(host: Element, bubble: HTMLElement): void {
    const win = this.document.defaultView!;
    const viewportWidth = this.document.documentElement.clientWidth;
    const viewportHeight = win.innerHeight;
    const target = host.getBoundingClientRect();
    const box = bubble.getBoundingClientRect();
    const wantsAbove = host.classList.contains('tooltip-above');
    const roomBelow = viewportHeight - target.bottom - GAP - MARGIN;
    const roomAbove = target.top - GAP - MARGIN;
    const above = wantsAbove ? roomAbove >= box.height || roomAbove >= roomBelow : roomBelow < box.height && roomAbove > roomBelow;
    const top = above ? target.top - GAP - box.height : target.bottom + GAP;
    const centered = target.left + target.width / 2 - box.width / 2;
    const left = Math.max(MARGIN, Math.min(centered, viewportWidth - box.width - MARGIN));
    const arrowX = Math.max(ARROW_EDGE, Math.min(target.left + target.width / 2 - left, box.width - ARROW_EDGE));

    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
    bubble.classList.toggle('app-tooltip--above', above);
    this.arrow!.style.left = `${Math.round(arrowX)}px`;
  }

  private ensureBubble(): HTMLElement {
    if (this.bubble) {
      return this.bubble;
    }
    const bubble = this.document.createElement('div');
    bubble.className = 'app-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.setAttribute('aria-hidden', 'true');
    bubble.appendChild(this.document.createTextNode(''));
    const arrow = this.document.createElement('span');
    arrow.className = 'app-tooltip__arrow';
    bubble.appendChild(arrow);
    this.document.body.appendChild(bubble);
    this.bubble = bubble;
    this.arrow = arrow;
    return bubble;
  }

  private closestHost(target: EventTarget | null): Element | null {
    return target instanceof Element ? target.closest('[data-tooltip]') : null;
  }

  private onOver(target: EventTarget | null): void {
    const host = this.closestHost(target);
    if (host) {
      this.show(host);
    } else if (this.host) {
      this.hide();
    }
  }

  private onOut(event: MouseEvent): void {
    const host = this.closestHost(event.target);
    if (host && !(event.relatedTarget instanceof Node && host.contains(event.relatedTarget))) {
      this.hide();
    }
  }

  private onFocus(target: EventTarget | null): void {
    const host = this.closestHost(target);
    if (host && (target as Element).matches(':focus-visible')) {
      this.show(host);
    }
  }

  private onTouch(target: EventTarget | null): void {
    if (this.host && this.closestHost(target) !== this.host) {
      this.hide();
    }
  }
}
