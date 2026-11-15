import { Injectable } from '@angular/core';
import { AuthenticatedUser, CustomerAccountProfile } from '../models/auth.model';

const AUTH_SESSION_STORAGE_KEY = 'hl-gestao-auth-session';
/**
 * Marca que ja existiu login neste navegador. O refresh token vive em cookie HttpOnly e o JS nao
 * consegue le-lo, entao sem esta marca o app chamava /auth/refresh em toda visita anonima e
 * registrava um 401 no console de quem so esta olhando o site.
 */
const REFRESHABLE_SESSION_STORAGE_KEY = 'hl-gestao-has-session';
/** Sessoes de cliente por empresa de antes da conta unica (Fase 3): so lida para ser apagada. */
const LEGACY_CUSTOMER_SESSIONS_STORAGE_KEY = 'hl-gestao-customer-sessions';
/** Sessao da conta do cliente (Fase 3): uma so, para todas as empresas. */
const CUSTOMER_ACCOUNT_SESSION_STORAGE_KEY = 'hl-gestao-customer-account';
/** Id do usuario que escolheu "Fazer depois" no primeiro acesso durante o login atual. */
const ONBOARDING_POSTPONED_STORAGE_KEY = 'hl-gestao-onboarding-postponed';

export interface StoredAuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  accessTokenExpiresAt: string;
}

/** Sessao da conta do cliente guardada no navegador; o refresh token fica no cookie HttpOnly. */
export interface StoredCustomerAccountSession {
  account: CustomerAccountProfile;
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Ultima empresa em que a conta usou a area do cliente: leva links antigos sem slug (/cliente) para ela. */
  lastCompanySlug: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  /** Salva a sessao autenticada serializavel no navegador. */
  saveSession(session: StoredAuthSession): void {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(REFRESHABLE_SESSION_STORAGE_KEY, 'true');
  }

  /** Informa se vale tentar renovar a sessao pelo cookie ou se o visitante nunca logou aqui. */
  hasRefreshableSession(): boolean {
    return localStorage.getItem(REFRESHABLE_SESSION_STORAGE_KEY) === 'true';
  }

  /** Recupera a sessao salva sem expor localStorage aos componentes. */
  getSession(): StoredAuthSession | null {
    const storedSession = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!storedSession) {
      return null;
    }

    try {
      return JSON.parse(storedSession) as StoredAuthSession;
    } catch {
      this.clearSession();
      return null;
    }
  }

  /**
   * Sessao da conta do cliente guardada neste navegador. As sessoes por empresa de antes da conta unica sao apagadas
   * (o token delas nao vale nas rotas novas: a pessoa entra de novo uma vez). Conteudo ilegivel e descartado.
   */
  getCustomerAccountSession(): StoredCustomerAccountSession | null {
    localStorage.removeItem(LEGACY_CUSTOMER_SESSIONS_STORAGE_KEY);
    const stored = localStorage.getItem(CUSTOMER_ACCOUNT_SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(stored);
      return isStoredCustomerAccountSession(parsed) ? parsed : this.dropCustomerAccountSession();
    } catch {
      return this.dropCustomerAccountSession();
    }
  }

  saveCustomerAccountSession(session: StoredCustomerAccountSession | null): void {
    if (!session) {
      localStorage.removeItem(CUSTOMER_ACCOUNT_SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(CUSTOMER_ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private dropCustomerAccountSession(): null {
    localStorage.removeItem(CUSTOMER_ACCOUNT_SESSION_STORAGE_KEY);
    return null;
  }

  /** Remove somente dados da sessao autenticada. */
  clearSession(): void {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(REFRESHABLE_SESSION_STORAGE_KEY);
    this.forgetOnboardingPostponed();
  }

  /** "Fazer depois" do primeiro acesso: vale para este usuario ate o proximo login (sobrevive a F5 e outras abas). */
  markOnboardingPostponed(userId: string): void {
    localStorage.setItem(ONBOARDING_POSTPONED_STORAGE_KEY, userId);
  }

  isOnboardingPostponed(userId: string): boolean {
    return localStorage.getItem(ONBOARDING_POSTPONED_STORAGE_KEY) === userId;
  }

  /** Chamado a cada login e ao sair: o assistente volta a abrir sozinho. */
  forgetOnboardingPostponed(): void {
    localStorage.removeItem(ONBOARDING_POSTPONED_STORAGE_KEY);
  }
}

function isStoredCustomerAccountSession(value: unknown): value is StoredCustomerAccountSession {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredCustomerAccountSession>;
  return typeof candidate.accessToken === 'string' && typeof candidate.accessTokenExpiresAt === 'string' && typeof candidate.account?.id === 'string';
}
