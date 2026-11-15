import { ADMIN_AUTHORIZED_AREAS } from '../../../core/authorization/admin-authorized-area';
import { AdminNavigationGroup, AdminNavigationItem } from '../models/admin-navigation.model';

const adminAreaByRoute = new Map(ADMIN_AUTHORIZED_AREAS.map((area) => [area.route, area]));

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = [
  createNavigationItem('/admin/dashboard', 'layout-dashboard'),
  createNavigationItem('/admin/agenda', 'calendar'),
  createNavigationItem('/admin/profissionais', 'users'),
  createNavigationItem('/admin/servicos', 'scissors'),
  createNavigationItem('/admin/assinaturas/assinantes', 'award'),
  createNavigationItem('/admin/assinaturas/planos', 'file-text'),
  createNavigationItem('/admin/assinaturas/analises', 'trending-up'),
  createNavigationItem('/admin/fidelidade', 'star'),
  createNavigationItem('/admin/produtos', 'package'),
  createNavigationItem('/admin/fornecedores', 'truck'),
  createNavigationItem('/admin/compras', 'shopping-cart'),
  createNavigationItem('/admin/horarios', 'clock'),
  createNavigationItem('/admin/clientes', 'user'),
  createNavigationItem('/admin/retencao', 'trending-up'),
  createNavigationItem('/admin/fila-espera', 'list-checks', { iconAssetPath: '/assets/icons/fila-espera.png' }),
  createNavigationItem('/admin/financeiro', 'wallet'),
  createNavigationItem('/admin/contas', 'receipt'),
  createNavigationItem('/admin/despesas-recorrentes', 'repeat'),
  createNavigationItem('/admin/movimentacoes', 'arrow-left-right'),
  createNavigationItem('/admin/comissoes', 'coins'),
  createNavigationItem('/admin/estornos-de-comissao', 'undo'),
  createNavigationItem('/admin/relatorios', 'bar-chart'),
  createNavigationItem('/admin/horarios-de-pico', 'trending-up', { route: '/painel/horarios-de-pico' }),
  createNavigationItem('/admin/pagamentos/minha-conta', 'credit-card'),
  createNavigationItem('/admin/pagamentos/cobrancas', 'receipt', { exact: false }),
  createNavigationItem('/admin/pagamentos/regras', 'repeat'),
  createNavigationItem('/admin/meu-plano', 'sparkles'),
  createNavigationItem('/admin/configuracoes', 'settings')
];

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    collapsible: false,
    routes: ['/admin/dashboard', '/admin/agenda', '/admin/fila-espera']
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    collapsible: true,
    routes: ['/admin/profissionais', '/admin/servicos', '/admin/produtos', '/admin/fornecedores', '/admin/clientes']
  },
  {
    id: 'assinaturas',
    label: 'Assinaturas',
    collapsible: true,
    routes: ['/admin/assinaturas/planos', '/admin/assinaturas/assinantes', '/admin/assinaturas/analises', '/admin/fidelidade']
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    collapsible: true,
    routes: ['/admin/financeiro', '/admin/contas', '/admin/despesas-recorrentes', '/admin/movimentacoes', '/admin/comissoes', '/admin/estornos-de-comissao']
  },
  {
    id: 'pagamentos',
    label: 'Pagamentos',
    collapsible: true,
    routes: ['/admin/pagamentos/minha-conta', '/admin/pagamentos/cobrancas', '/admin/pagamentos/regras']
  },
  {
    id: 'operacao',
    label: 'Operação',
    collapsible: true,
    routes: ['/admin/compras', '/admin/horarios']
  },
  {
    id: 'analises',
    label: 'Análises',
    collapsible: true,
    routes: ['/admin/retencao', '/admin/relatorios', '/painel/horarios-de-pico']
  },
  {
    id: 'sistema',
    label: 'Sistema',
    collapsible: true,
    routes: ['/admin/meu-plano', '/admin/configuracoes']
  }
];

/** Cria item de navegacao a partir da area autorizada central, evitando dependencia de indices. */
function createNavigationItem(
  areaRoute: string,
  icon: AdminNavigationItem['icon'],
  overrides: Partial<Pick<AdminNavigationItem, 'route' | 'iconAssetPath' | 'exact'>> = {}
): AdminNavigationItem {
  const area = adminAreaByRoute.get(areaRoute);

  if (!area) {
    throw new Error(`Área administrativa não encontrada para a rota ${areaRoute}.`);
  }

  return {
    ...area,
    icon,
    exact: true,
    ...overrides
  };
}
