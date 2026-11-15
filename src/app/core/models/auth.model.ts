export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';
export type UserRole = 'admin' | 'client';

export enum AdminUserRole {
  Owner = 'Owner',
  Admin = 'Admin',
  Professional = 'Professional',
}

export interface AuthenticatedUser {
  id: string;
  companyId?: string;
  professionalId?: string | null;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  adminRole?: AdminUserRole;
  permissions?: string[];
  avatarUrl?: string;
  /** Conta da equipe com o e-mail confirmado (sessao de suporte: sempre true). */
  emailVerified?: boolean;
  /** Empresas em que a conta pode entrar ("Trocar de empresa" so com mais de uma). */
  companyCount?: number;
}

export interface BackendAuthenticatedUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: AdminUserRole;
  professionalId?: string | null;
  avatarUrl?: string | null;
  permissions: string[];
  emailVerified?: boolean;
  companyCount?: number;
}

export interface BackendAuthenticatedCustomer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Empresa em que a conta da equipe pode entrar (escolha no login e troca de empresa). */
export interface StaffCompany {
  companyId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: AdminUserRole;
}

export interface PendingLegalDocument {
  id: string;
  title: string;
  version: string;
}

/** Login com mais de uma empresa ou aceite pendente: token de selecao (5 min, uso unico), so em memoria. */
export interface StaffCompanySelection {
  token: string;
  expiresAt: string;
  companies: StaffCompany[];
  lastCompanyId: string | null;
  pendingLegalDocuments: PendingLegalDocument[];
}

export interface BackendStaffSignInResponse {
  status: 'authenticated' | 'selection-required';
  user: BackendAuthenticatedUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  selection: StaffCompanySelection | null;
}

export type StaffSignInResult =
  | { status: 'authenticated'; response: LoginResponse }
  | { status: 'selection-required'; selection: StaffCompanySelection };

export interface StaffCompanies {
  companies: StaffCompany[];
  lastCompanyId: string | null;
  currentCompanyId: string | null;
}

export interface StaffInvitationPreview {
  companyName: string;
  email: string;
  accountHasPassword: boolean;
}

export interface StaffInvitationAccepted {
  companyName: string;
  email: string;
}

/** Documento aceito na versao que a tela mostrou (Termos, Privacidade). */
export interface AcceptedLegalDocument {
  id: string;
  version: string;
}

/** Conta do cliente (Fase 3): uma para todas as empresas; nunca traz os vinculos. */
export interface CustomerAccountProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerified: boolean;
  /** A conta tem senha (a criada so com o Google nao tem ate pedir "Criar uma senha"). */
  hasPassword?: boolean;
  googleLinked?: boolean;
}

export interface CustomerAccountLoginRequest extends LoginRequest {
  acceptedDocuments?: AcceptedLegalDocument[];
}

export interface CustomerAccountRegisterRequest {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedDocuments: AcceptedLegalDocument[];
}

export interface BackendCustomerSignInResponse {
  status: 'authenticated' | 'legal-acceptance-required';
  account: CustomerAccountProfile | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  pendingLegalDocuments: PendingLegalDocument[];
}

/** Login do cliente: sessao aberta, ou a senha certa com Termos e Privacidade para aceitar antes. */
export type CustomerSignInResult =
  | { status: 'authenticated'; account: CustomerAccountProfile }
  | { status: 'legal-acceptance-required'; documents: PendingLegalDocument[] };

export interface CustomerAccountRefreshResponse {
  account: CustomerAccountProfile;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface CustomerEmailVerified {
  linkedCompanies: number;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface BackendLoginResponse {
  user: BackendAuthenticatedUser;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface GoogleLoginRequest {
  credential: string;
  acceptedDocuments?: AcceptedLegalDocument[];
}

export interface PublicAuthOptions {
  googleClientId: string | null;
  /** URL do site do ambiente (Auth:FrontendBaseUrl), sem barra no fim; vazia se a API nao respondeu. */
  publicSiteUrl: string;
}
