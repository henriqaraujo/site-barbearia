import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TenantContextStore } from '../../core/tenancy/tenant-context.store';
import { UI_TERMS } from '../../core/constants/ui-terms';

/**
 * Casca de toda rota da empresa (/:companySlug/**): site, login, cadastro, area do cliente. A empresa ja chega
 * resolvida pelo tenantGuard; aqui so se decide entre a pagina pedida, "Barbearia nao encontrada" e
 * "Agendamento temporariamente indisponivel" (empresa desativada ou com o site fora por falta de pagamento do plano:
 * o cliente final nunca ve o motivo).
 */
@Component({
  selector: 'app-tenant-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './tenant-shell.component.html',
  styleUrl: './tenant-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantShellComponent {
  /** Termo do negocio nos textos (empresa), central em core/constants/ui-terms. */
  readonly terms = UI_TERMS;
  private readonly document = inject(DOCUMENT);
  readonly tenant = inject(TenantContextStore);

  retry(): void {
    this.document.location.reload();
  }
}
