import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Subconjunto usado da API do Google Identity Services (window.google.accounts.id). */
interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    context?: 'signin' | 'signup' | 'use';
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/** Carrega o script do Google so quando uma tela de login do cliente precisa do botao. */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly document = inject(DOCUMENT);
  private loadPromise: Promise<GoogleAccountsId> | null = null;

  load(): Promise<GoogleAccountsId> {
    this.loadPromise ??= new Promise<GoogleAccountsId>((resolve, reject) => {
      const loadedApi = this.document.defaultView?.google?.accounts?.id;
      if (loadedApi) {
        resolve(loadedApi);
        return;
      }

      const script = this.document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const api = this.document.defaultView?.google?.accounts?.id;
        if (api) {
          resolve(api);
        } else {
          reject(new Error('Google Identity Services indisponivel.'));
        }
      };
      script.onerror = () => {
        // Permite nova tentativa numa proxima visita a tela (rede instavel, bloqueador de anuncios).
        this.loadPromise = null;
        script.remove();
        reject(new Error('Falha ao carregar o Google Identity Services.'));
      };
      this.document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
