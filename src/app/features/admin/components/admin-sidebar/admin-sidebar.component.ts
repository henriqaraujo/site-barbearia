import { ChangeDetectionStrategy, Component, HostListener, computed, effect, input, inject, output, signal, untracked } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { BrandMarkComponent } from '../../../../shared/components/brand-mark/brand-mark.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ADMIN_NAVIGATION_GROUPS, ADMIN_NAVIGATION_ITEMS } from '../../data/admin-navigation.data';
import { AdminNavigationGroup, AdminNavigationItem } from '../../models/admin-navigation.model';

interface VisibleAdminNavigationGroup extends AdminNavigationGroup {
  readonly items: readonly AdminNavigationItem[];
}

/**
 * Destaque do item do menu: compara so o caminho. Query string e fragmento nao contam, entao
 * /admin/profissionais?comissao=pendente (o "Revisar" do Inicio) destaca Profissionais.
 */
const EXACT_PATH_MATCH: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
const SUBSET_PATH_MATCH: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, BrandMarkComponent],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSidebarComponent {
  private readonly router = inject(Router);
  private readonly companyContextService = inject(CompanyContextService);
  private lastAutomaticallyOpenedGroupId: string | null = null;
  private readonly expandedGroupIds = signal<readonly string[]>([]);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly collapsed = input.required<boolean>();
  readonly mobileOpened = input.required<boolean>();
  readonly navigationItems = input<readonly AdminNavigationItem[]>(ADMIN_NAVIGATION_ITEMS);
  /** Categorias do menu; a plataforma passa as dela, o painel da empresa usa as padrao. */
  readonly groups = input<readonly AdminNavigationGroup[]>(ADMIN_NAVIGATION_GROUPS);
  /** Sobrescrevem a marca da empresa; sem logo, o menu mostra as iniciais da marca. */
  readonly brandNameOverride = input<string | null>(null);
  readonly logoUrlOverride = input<string | null | undefined>(undefined);
  readonly brandTag = input<string | null>(null);
  readonly ariaLabel = input('Menu administrativo');
  readonly navigationAriaLabel = input('Rotas do painel');
  readonly closeMobile = output<void>();
  readonly navigationGroups = computed(() => this.createVisibleNavigationGroups());
  readonly activeGroupId = computed(() => this.findActiveGroupId());
  readonly brandName = computed(() => this.brandNameOverride() ?? this.companyContextService.fullName());
  readonly brandShortName = computed(() => this.brandNameOverride() ?? this.companyContextService.name());
  readonly logoUrl = computed(() => {
    const override = this.logoUrlOverride();
    return override === undefined ? this.companyContextService.logoUrl() : override;
  });

  constructor() {
    effect(() => {
      const activeGroupId = this.activeGroupId();

      if (activeGroupId && activeGroupId !== this.lastAutomaticallyOpenedGroupId) {
        untracked(() => this.openGroup(activeGroupId));
      }

      this.lastAutomaticallyOpenedGroupId = activeGroupId;
    });
  }

  /** Fecha o drawer mobile quando o usuario pressiona Escape. */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.mobileOpened()) {
      this.closeMobile.emit();
    }
  }

  /** Fecha a sidebar mobile depois de navegar. */
  handleNavigation(): void {
    if (this.mobileOpened()) {
      this.closeMobile.emit();
    }
  }

  /** Alterna uma categoria colapsavel sem sobrescrever a escolha manual do usuario. */
  toggleGroup(group: VisibleAdminNavigationGroup): void {
    if (!group.collapsible) {
      return;
    }

    const expandedGroupIds = this.expandedGroupIds();

    if (expandedGroupIds.includes(group.id)) {
      this.expandedGroupIds.set(expandedGroupIds.filter((groupId) => groupId !== group.id));
      return;
    }

    this.expandedGroupIds.set([...expandedGroupIds, group.id]);
  }

  /** Mantem abertas categorias fixas, grupos escolhidos e todos os itens no modo compacto. */
  isGroupExpanded(group: VisibleAdminNavigationGroup): boolean {
    return this.collapsed() || !group.collapsible || this.expandedGroupIds().includes(group.id);
  }

  /** Opcoes do routerLinkActive: so o caminho conta (exato ou como prefixo). */
  activeMatchOptions(item: AdminNavigationItem): IsActiveMatchOptions {
    return item.exact ? EXACT_PATH_MATCH : SUBSET_PATH_MATCH;
  }

  /** Informa ao template se a categoria contem a rota atual. */
  isGroupActive(group: VisibleAdminNavigationGroup): boolean {
    return group.items.some((item) => this.isNavigationItemActive(item));
  }

  /** Monta categorias sem duplicar a regra de permissao aplicada pelo componente pai. */
  private createVisibleNavigationGroups(): readonly VisibleAdminNavigationGroup[] {
    const visibleItems = this.navigationItems();
    const itemByRoute = new Map(visibleItems.map((item) => [item.route, item]));
    const groups = this.groups();
    const groupedRoutes = new Set(groups.flatMap((group) => group.routes));
    const configuredGroups = groups
      .map((group) => ({
        ...group,
        items: group.routes.map((route) => itemByRoute.get(route)).filter((item): item is AdminNavigationItem => Boolean(item))
      }))
      .filter((group) => group.items.length > 0);
    const ungroupedItems = visibleItems.filter((item) => !groupedRoutes.has(item.route));

    if (!ungroupedItems.length) {
      return configuredGroups;
    }

    // Menu que nao casa com nenhuma categoria (area do cliente) fica sem cabecalho,
    // em vez de ganhar um rotulo generico "Outros" que nao diz nada ao usuario.
    const hasConfiguredGroups = configuredGroups.length > 0;

    return [
      ...configuredGroups,
      {
        id: 'outros',
        label: hasConfiguredGroups ? 'Outros' : '',
        collapsible: hasConfiguredGroups,
        routes: ungroupedItems.map((item) => item.route),
        items: ungroupedItems
      }
    ];
  }

  /** Abre uma categoria quando a rota ativa entra nela, preservando outras aberturas manuais. */
  private openGroup(groupId: string): void {
    const expandedGroupIds = this.expandedGroupIds();

    if (expandedGroupIds.includes(groupId)) {
      return;
    }

    this.expandedGroupIds.set([...expandedGroupIds, groupId]);
  }

  /** Localiza a categoria que contem a rota ativa atual. */
  private findActiveGroupId(): string | null {
    return this.navigationGroups().find((group) => this.isGroupActive(group))?.id ?? null;
  }

  /** Compara a URL atual com a configuracao de ativacao do item. */
  private isNavigationItemActive(item: AdminNavigationItem): boolean {
    const currentPath = this.currentUrl().split(/[?#]/)[0];

    if (item.exact) {
      return currentPath === item.route;
    }

    return currentPath === item.route || currentPath.startsWith(`${item.route}/`);
  }
}
