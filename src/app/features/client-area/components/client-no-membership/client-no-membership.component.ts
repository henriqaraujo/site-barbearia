import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantUrlPipe } from '../../../../core/tenancy/tenant-url.pipe';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TermPipe } from '../../../../shared/pipes/term.pipe';

/**
 * Area do cliente da conta logada que ainda nao tem vinculo nesta empresa (Fase 3): a area abre e mostra este estado
 * vazio, no lugar das telas que dependem do vinculo. Abrir a area nao cria vinculo: ele nasce ao agendar, entrar na
 * fila ou contratar plano (item 7).
 */
@Component({
  selector: 'app-client-no-membership',
  standalone: true,
  imports: [TermPipe, RouterLink, TenantUrlPipe, IconComponent],
  templateUrl: './client-no-membership.component.html',
  styleUrl: './client-no-membership.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientNoMembershipComponent {
  /** Nome cadastrado da empresa; vazio so enquanto carrega (o texto sai sem nome, nunca com um provisorio). */
  readonly companyName = input<string>('');
}
