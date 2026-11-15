import { ADMIN_PERMISSIONS, AdminPermission } from '../constants/admin-permissions.constants';
import { AdminUserRole } from '../models/auth.model';

export interface AdminAuthorizedArea {
  label: string;
  route: string;
  roles: readonly AdminUserRole[];
  requiredPermissions?: readonly AdminPermission[];
}

export const ADMIN_AUTHORIZED_AREAS: readonly AdminAuthorizedArea[] = [
  { label: 'Início', route: '/admin/dashboard', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.dashboardView] },
  { label: 'Agenda', route: '/admin/agenda', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.appointmentsViewOwn, ADMIN_PERMISSIONS.appointmentsViewAll] },
  { label: 'Profissionais', route: '/admin/profissionais', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.professionalsView, ADMIN_PERMISSIONS.professionalsManage] },
  { label: 'Serviços', route: '/admin/servicos', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.servicesView, ADMIN_PERMISSIONS.servicesManage] },
  { label: 'Assinantes', route: '/admin/assinaturas/assinantes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.subscriptionsView, ADMIN_PERMISSIONS.subscriptionsManage] },
  { label: 'Planos', route: '/admin/assinaturas/planos', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.subscriptionPlansView, ADMIN_PERMISSIONS.subscriptionPlansManage] },
  { label: 'Fidelidade', route: '/admin/fidelidade', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.loyaltyView, ADMIN_PERMISSIONS.loyaltyManage, ADMIN_PERMISSIONS.settingsManage] },
  { label: 'Análises de assinaturas', route: '/admin/assinaturas/analises', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.subscriptionAnalyticsView] },
  { label: 'Produtos', route: '/admin/produtos', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.productsView, ADMIN_PERMISSIONS.productsManage] },
  { label: 'Fornecedores', route: '/admin/fornecedores', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.suppliersView, ADMIN_PERMISSIONS.suppliersManage] },
  { label: 'Compras', route: '/admin/compras', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.purchasesView, ADMIN_PERMISSIONS.purchasesManage] },
  { label: 'Horários', route: '/admin/horarios', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.scheduleViewOwn, ADMIN_PERMISSIONS.scheduleManageAll] },
  { label: 'Clientes', route: '/admin/clientes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.customersViewOwn, ADMIN_PERMISSIONS.customersViewAll] },
  { label: 'Retenção', route: '/admin/retencao', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.customersViewOwn, ADMIN_PERMISSIONS.customersViewAll] },
  { label: 'Fila de espera', route: '/admin/fila-espera', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.appointmentsViewAll, ADMIN_PERMISSIONS.appointmentsManageAll] },
  { label: 'Financeiro', route: '/admin/financeiro', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.financeViewOwn, ADMIN_PERMISSIONS.financeViewAll, ADMIN_PERMISSIONS.financeManage] },
  { label: 'Contas a pagar/receber', route: '/admin/contas', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.accountsView, ADMIN_PERMISSIONS.accountsManage] },
  { label: 'Despesas recorrentes', route: '/admin/despesas-recorrentes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.recurringExpensesView, ADMIN_PERMISSIONS.recurringExpensesManage] },
  { label: 'Movimentações', route: '/admin/movimentacoes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.financialTransactionsView, ADMIN_PERMISSIONS.financialTransactionsManage] },
  { label: 'Estornos de comissão', route: '/admin/estornos-de-comissao', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.commissionsViewAll, ADMIN_PERMISSIONS.commissionsManage, ADMIN_PERMISSIONS.financeViewAll, ADMIN_PERMISSIONS.financeManage] },
  { label: 'Comissões', route: '/admin/comissoes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.commissionsViewOwn, ADMIN_PERMISSIONS.commissionsViewAll, ADMIN_PERMISSIONS.commissionsManage] },
  { label: 'Relatórios', route: '/admin/relatorios', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.reportsViewOwn, ADMIN_PERMISSIONS.reportsViewAll, ADMIN_PERMISSIONS.financeViewOwn, ADMIN_PERMISSIONS.financeViewAll] },
  { label: 'Horários de pico', route: '/admin/horarios-de-pico', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.reportsViewOwn, ADMIN_PERMISSIONS.reportsViewAll, ADMIN_PERMISSIONS.financeViewOwn, ADMIN_PERMISSIONS.financeViewAll] },
  // Conta de pagamentos (Asaas): ve quem tem Configuracoes ver ou gerenciar, como o GET da API; so gerenciar ativa.
  { label: 'Minha conta', route: '/admin/pagamentos/minha-conta', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.paymentsAccountView, ADMIN_PERMISSIONS.paymentsAccountManage] },
  // Cobrancas online: ve com Cobrancas ver ou gerenciar (Back ID 30); gerar exige gerenciar (na rota de nova cobranca).
  { label: 'Cobranças', route: '/admin/pagamentos/cobrancas', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.chargesView, ADMIN_PERMISSIONS.chargesManage] },
  // Regras de pagamento (ID 24): as secoes Assinaturas e Comissoes que viviam nas Configuracoes; permissao propria (PaymentRules.*), que o dono pode dar a um profissional.
  { label: 'Regras de pagamento', route: '/admin/pagamentos/regras', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.paymentRulesView, ADMIN_PERMISSIONS.paymentRulesManage] },
  // Plano da HL (ID 12): a API le para qualquer acesso do painel; e para onde levam os itens com cadeado.
  { label: 'Meu plano', route: '/admin/meu-plano', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional] },
  // Meu perfil (ID 26): a propria conta, sem permissao; fica no menu do avatar, nao na lateral.
  { label: 'Meu perfil', route: '/admin/meu-perfil', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional] },
  { label: 'Configurações', route: '/admin/configuracoes', roles: [AdminUserRole.Owner, AdminUserRole.Admin, AdminUserRole.Professional], requiredPermissions: [ADMIN_PERMISSIONS.settingsView, ADMIN_PERMISSIONS.settingsManage, ADMIN_PERMISSIONS.permissionsView, ADMIN_PERMISSIONS.permissionsManage] }
];

const DEFAULT_ADMIN_ROUTE_ORDER = [
  '/admin/dashboard',
  '/admin/agenda',
  '/admin/clientes',
  '/admin/retencao',
  '/admin/relatorios',
  '/admin/horarios-de-pico',
  '/admin/horarios',
  '/admin/profissionais',
  '/admin/servicos',
  '/admin/comissoes',
  '/admin/estornos-de-comissao',
  '/admin/financeiro',
  '/admin/movimentacoes',
  '/admin/contas',
  '/admin/despesas-recorrentes',
  '/admin/fornecedores',
  '/admin/compras',
  '/admin/assinaturas/assinantes',
  '/admin/assinaturas/planos',
  '/admin/assinaturas/analises',
  '/admin/fidelidade',
  '/admin/fila-espera',
  '/admin/configuracoes',
  '/admin/pagamentos/minha-conta',
  '/admin/pagamentos/cobrancas',
  '/admin/pagamentos/regras',
  '/admin/produtos'
] as const;

/** Normaliza alias legado /painel para comparar autorizacao com as rotas admin atuais. */
export function normalizeAdminRoute(route: string): string {
  return route.replace(/^\/painel(?=\/|$)/, '/admin');
}

/** Verifica se a area administrativa pode ser acessada pelo role e permissoes atuais. */
export function canAccessAdminArea(area: AdminAuthorizedArea, role: AdminUserRole | null, permissions: readonly string[]): boolean {
  if (!role || !area.roles.includes(role)) {
    return false;
  }

  if (role === AdminUserRole.Owner || role === AdminUserRole.Admin) {
    return true;
  }

  if (!area.requiredPermissions?.length) {
    return true;
  }

  return Boolean(area.requiredPermissions?.some((permission) => permissions.includes(permission)));
}

/** Retorna a primeira area funcional que o usuario administrativo pode abrir. */
export function getDefaultAuthorizedAdminArea(role: AdminUserRole | null, permissions: readonly string[]): AdminAuthorizedArea | null {
  for (const route of DEFAULT_ADMIN_ROUTE_ORDER) {
    const area = ADMIN_AUTHORIZED_AREAS.find((candidate) => candidate.route === route);

    if (area && canAccessAdminArea(area, role, permissions)) {
      return area;
    }
  }

  return null;
}

/** Encontra a area correspondente a uma URL somente quando a sessao atual pode acessa-la. */
export function findAuthorizedAdminAreaByUrl(url: string, role: AdminUserRole | null, permissions: readonly string[]): AdminAuthorizedArea | null {
  const normalizedUrl = normalizeAdminRoute(url).split(/[?#]/)[0];
  const area = ADMIN_AUTHORIZED_AREAS.find((candidate) => normalizedUrl === candidate.route || normalizedUrl.startsWith(`${candidate.route}/`));

  if (!area || !canAccessAdminArea(area, role, permissions)) {
    return null;
  }

  return area;
}


