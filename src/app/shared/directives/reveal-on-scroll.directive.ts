import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true
})
export class RevealOnScrollDirective implements OnInit, OnDestroy {
  private readonly elementReference = inject<ElementRef<HTMLElement>>(ElementRef);
  private intersectionObserver: IntersectionObserver | null = null;

  /** Inicia a observação do elemento e respeita usuários com redução de movimento. */
  ngOnInit(): void {
    const element = this.elementReference.nativeElement;
    element.classList.add('reveal');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add('is-visible');
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => this.revealElementWhenVisible(entry),
      { threshold: 0.16 }
    );
    this.intersectionObserver.observe(element);
  }

  /** Remove o observador para evitar vazamento de memória. */
  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  /** Aplica a classe visual somente na primeira vez em que o elemento aparece. */
  private revealElementWhenVisible(entry: IntersectionObserverEntry | undefined): void {
    if (!entry?.isIntersecting) {
      return;
    }

    this.elementReference.nativeElement.classList.add('is-visible');
    this.intersectionObserver?.disconnect();
  }
}
