import { IconName } from '../../../shared/components/icon/icon.component';
import { AdminPermission } from '../../../core/constants/admin-permissions.constants';
import { AdminUserRole } from '../../../core/models/auth.model';

export interface AdminNavigationItem {
  label: string;
  route: string;
  icon: IconName;
  iconAssetPath?: string;
  exact: boolean;
  badgeCount?: number;
  /** Funcao fora do plano da HL: o item aparece com cadeado e este texto (ex.: "Disponível no plano Premium"). */
  lockedHint?: string;
  roles?: readonly AdminUserRole[];
  requiredPermissions?: readonly AdminPermission[];
}

export interface AdminNavigationGroup {
  id: string;
  label: string;
  collapsible: boolean;
  routes: readonly string[];
}

export interface AdminBreadcrumbItem {
  label: string;
  url: string;
}
