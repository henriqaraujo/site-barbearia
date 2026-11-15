import { InjectionToken } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export type BrowserLockRunner = <T>(name: string, task: () => Observable<T>) => Observable<T>;

/**
 * Roda a tarefa com exclusividade entre as abas do mesmo navegador (Web Locks API). Serve para a renovacao da sessao:
 * duas abas renovando juntas apresentariam o mesmo refresh token, e o servidor trata a segunda como reutilizacao e
 * derruba a sessao (Fase 2 da conta unica). A trava e liberada quando a tarefa termina, falha ou e cancelada. Sem a
 * API (navegador antigo), roda direto.
 */
export const runExclusive: BrowserLockRunner = <T>(name: string, task: () => Observable<T>): Observable<T> => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) {
    return task();
  }

  return new Observable<T>((subscriber) => {
    let inner: Subscription | undefined;
    let release: (() => void) | undefined;
    void locks.request(name, () => new Promise<void>((resolve) => {
      release = resolve;
      inner = task().subscribe({
        next: (value) => subscriber.next(value),
        error: (error: unknown) => {
          resolve();
          subscriber.error(error);
        },
        complete: () => {
          resolve();
          subscriber.complete();
        }
      });
    }));

    return () => {
      inner?.unsubscribe();
      release?.();
    };
  });
};

/** Trava entre abas usada pela sessao; os testes trocam por uma que roda direto (sem a espera da Web Locks API). */
export const BROWSER_LOCK = new InjectionToken<BrowserLockRunner>('BROWSER_LOCK', { providedIn: 'root', factory: () => runExclusive });

/** Para os testes: roda a tarefa direto, sem trava. */
export const runWithoutLock: BrowserLockRunner = (_name, task) => task();
