import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  readonly id: number;
  readonly title: string;
  readonly message: string;
  readonly code?: string;
  /** Alerta (ex.: funcao fora do plano); sem tom, sucesso. */
  readonly tone?: 'success' | 'warning';
}

const DEFAULT_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<readonly ToastMessage[]>([]);
  private nextId = 0;
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Exibe um toast de sucesso discreto que some sozinho apos alguns segundos. */
  showSuccess(title: string, message: string, code?: string, durationMs = DEFAULT_DURATION_MS): void {
    const id = ++this.nextId;
    this.toasts.update((toasts) => [...toasts, { id, title, message, code }]);
    this.dismissTimers.set(id, setTimeout(() => this.dismiss(id), durationMs));
  }

  /** Alerta que nao e erro da tela (ex.: funcao fora do plano); fica um pouco mais para dar tempo de ler. */
  showWarning(title: string, message: string, durationMs = DEFAULT_DURATION_MS * 2): void {
    const id = ++this.nextId;
    this.toasts.update((toasts) => [...toasts, { id, title, message, tone: 'warning' }]);
    this.dismissTimers.set(id, setTimeout(() => this.dismiss(id), durationMs));
  }

  /** Remove um toast manualmente ou apos o auto-dismiss. */
  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));

    const timer = this.dismissTimers.get(id);

    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }
  }
}
