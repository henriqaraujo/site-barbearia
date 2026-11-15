import { Route, Routes } from '@angular/router';
import { clientGuard, customerAccountGuard, myAccountGuard } from './core/guards/client.guard';
import { legacyCustomerResetRedirect, legacyCustomerRouteRedirect, legacyWaitlistCancelRedirect } from './core/guards/legacy-redirect.guards';
import { loginGuard } from './core/guards/login.guard';
import { PLATFORM_BRAND } from './core/constants/platform-brand.constants';
import { LEGAL_DOCUMENTS, PAYMENT_TERMS_DOCUMENT } from './core/legal/legal-documents';
import { tenantGuard } from './core/tenancy/tenant.guard';
import { environment } from '../environments/environment';
import { DEMO_COMPANY_SLUG } from './demo/demo-data';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { TenantShellComponent } from './layout/tenant-shell/tenant-shell.component';
import { legalDocumentGuard } from './features/legal/legal-document.guard';

/** Rota de cliente antiga, sem empresa na URL: vai para a mesma rota na barbearia da sessao de cliente, ou para /. */
function legacyCustomerRoute(path: string): Route {
  return { path, canActivate: [legacyCustomerRouteRedirect], children: [{ path: '**', children: [] }] };
}

const publicChildren: Routes = [
  {
    // Perfil da empresa (Fase 5, D9) no lugar da home de marketing.
    path: '',
    loadComponent: () => import('./features/home/home.component').then((component) => component.HomeComponent)
  },
  {
    path: 'agendamento',
    loadComponent: () => import('./features/booking/booking.component').then((component) => component.BookingComponent)
  },
  {
    path: 'assinatura/contratar/:planId',
    canActivate: [customerAccountGuard],
    loadComponent: () => import('./features/subscription-checkout/subscription-checkout.component').then((component) => component.SubscriptionCheckoutComponent)
  }
];

/**
 * Tudo o que e da empresa, sob o endereco dela. As telas de conta sao do cliente final daquela barbearia; a equipe
 * entra pelo /login sem empresa.
 */
const companyChildren: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((component) => component.LoginComponent)
  },
  {
    path: 'cadastro',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/register/register.component').then((component) => component.RegisterComponent)
  },
  {
    path: 'esqueci-senha',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then((component) => component.ForgotPasswordComponent)
  },
  {
    path: 'redefinir-senha',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then((component) => component.ResetPasswordComponent)
  },
  {
    path: 'fila/cancelar',
    loadComponent: () => import('./features/waitlist-cancel/waitlist-cancel.component').then((component) => component.WaitlistCancelComponent)
  },
  {
    path: 'cliente',
    canActivate: [clientGuard],
    loadChildren: () => import('./features/client-area/client-area.routes').then((routes) => routes.clientAreaRoutes)
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: publicChildren
  }
];

export const appRoutes: Routes = [
environment.presentationMock
  ? { path: '', pathMatch: 'full' as const, redirectTo: DEMO_COMPANY_SLUG }
  : {
    path: '',
    pathMatch: 'full' as const,
    data: { mode: 'inicio' },
    loadComponent: () => import('./features/root-landing/root-landing.component').then((component) => component.RootLandingComponent)
  },
{
    // Buscar (cabecalho da plataforma, 07/10): a busca por nome e cidade; a raiz e o Inicio.
    path: 'buscar',
    title: 'Buscar · ' + PLATFORM_BRAND.name,
    data: { mode: 'buscar' },
    loadComponent: () => import('./features/root-landing/root-landing.component').then((component) => component.RootLandingComponent)
  },
{
    // Conta do cliente pela raiz (conta unica, Fase 3): o mesmo login e cadastro de /{slug}/login, sem empresa.
    path: 'entrar',
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { customerAccount: true },
        canActivate: [loginGuard],
        loadComponent: () => import('./features/auth/login/login.component').then((component) => component.LoginComponent)
      },
      {
        path: 'cadastro',
        data: { customerAccount: true },
        canActivate: [loginGuard],
        loadComponent: () => import('./features/auth/register/register.component').then((component) => component.RegisterComponent)
      },
      {
        path: 'esqueci-senha',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then((component) => component.ForgotPasswordComponent)
      },
      {
        path: 'redefinir-senha',
        data: { customerAccount: true },
        loadComponent: () => import('./features/auth/reset-password/reset-password.component').then((component) => component.ResetPasswordComponent)
      },
      {
        path: 'verificar-email',
        loadComponent: () => import('./features/auth/customer-verify-email/customer-verify-email.component').then((component) => component.CustomerVerifyEmailComponent)
      },
      {
        // Troca de e-mail da conta (Fase 4): confirmar o novo e "Nao fui eu" (#token=).
        path: 'confirmar-novo-email',
        data: { emailChange: 'confirm' },
        loadComponent: () => import('./features/auth/email-change-link/email-change-link.component').then((component) => component.EmailChangeLinkComponent)
      },
      {
        path: 'desfazer-troca-de-email',
        data: { emailChange: 'revert' },
        loadComponent: () => import('./features/auth/email-change-link/email-change-link.component').then((component) => component.EmailChangeLinkComponent)
      }
    ]
  },
{
    // Area global da conta do cliente (Fase 4): agendamentos de todas as empresas, agendar e dados da conta.
    path: 'minha-conta',
    canActivate: [myAccountGuard],
    loadChildren: () => import('./features/my-account/my-account.routes').then((routes) => routes.myAccountRoutes)
  },
legacyCustomerRoute('agendamento'),
legacyCustomerRoute('assinatura'),
legacyCustomerRoute('cadastro'),
legacyCustomerRoute('cliente'),
{
    // Redefinicao da equipe. Link antigo de cliente (conta=cliente&empresa=x) vai para /x/redefinir-senha.
    path: 'redefinir-senha',
    canActivate: [legacyCustomerResetRedirect],
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then((component) => component.ResetPasswordComponent)
  },
{
    // Link antigo de sair da fila (#token=...&empresa=x) vai para /x/fila/cancelar. "fila" e palavra reservada de slug.
    path: 'fila/cancelar',
    canActivate: [legacyWaitlistCancelRedirect],
    loadComponent: () => import('./features/waitlist-cancel/waitlist-cancel.component').then((component) => component.WaitlistCancelComponent)
  },
...LEGAL_DOCUMENTS.map((document) => ({
    // /termos e /privacidade (palavras reservadas de slug). Em producao, rascunho volta para a raiz (legalDocumentGuard).
    path: document.id,
    title: document.title,
    data: { document: document.id },
    canActivate: [legalDocumentGuard],
    loadComponent: () => import('./features/legal/legal-document-page.component').then((component) => component.LegalDocumentPageComponent)
  })),
{
    // Termos de pagamento (/termos/pagamento): mesma pagina e mesma regra de rascunho dos Termos e da Privacidade.
    path: PAYMENT_TERMS_DOCUMENT.path.slice(1),
    title: PAYMENT_TERMS_DOCUMENT.title,
    data: { document: PAYMENT_TERMS_DOCUMENT.id },
    canActivate: [legalDocumentGuard],
    loadComponent: () => import('./features/legal/legal-document-page.component').then((component) => component.LegalDocumentPageComponent)
  },
{
    // A empresa vem so da URL: o tenantGuard resolve o slug (atual ou antigo) e preenche o TenantContextStore.
    path: ':companySlug',
    component: TenantShellComponent,
    canActivate: [tenantGuard],
    children: companyChildren
  },
{
    path: '**',
    redirectTo: ''
  }
];
