import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Mesma quebra do topo do painel: abaixo dela o botao de menu vira o do celular e o seletor desce para baixo do topo. */
const COMPACT_QUERY = '(max-width: 900px)';

/**
 * Tela estreita (celular), para os layouts da /minha-conta e da area do cliente porem o seletor de empresa logo abaixo
 * do topo. Chamar em contexto de injecao (construtor ou campo).
 */
export function injectCompactLayout(): Signal<boolean> {
  const compact = signal(false);
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return compact.asReadonly();
  }

  const media = window.matchMedia(COMPACT_QUERY);
  compact.set(media.matches);
  const listener = (event: MediaQueryListEvent) => compact.set(event.matches);
  media.addEventListener('change', listener);
  inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
  return compact.asReadonly();
}
