import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerSessionService } from '../../../../core/services/customer-session.service';
import { CustomDropdownDirective } from '../../../../shared/directives/custom-dropdown.directive';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../admin/components/searchable-select/searchable-select.component';
import { ClientStatusBadgeComponent } from '../../components/client-status-badge/client-status-badge.component';
import { ClientFormatService } from '../../services/client-format.service';
import { ClientHistoryService } from '../../services/client-history.service';
import { TenantUrlPipe } from '../../../../core/tenancy/tenant-url.pipe';
import { TermPipe } from '../../../../shared/pipes/term.pipe';

/** Quantos atendimentos entram por vez na rolagem infinita. */
const PAGE_SIZE = 12;
const SCROLL_THRESHOLD_PX = 360;

const PERIOD_OPTIONS: readonly SearchableSelectOption[] = [
  { id: 'all', label: 'Todos' },
  { id: '30', label: 'Últimos 30 dias' },
  { id: '90', label: 'Últimos 90 dias' }
];

const SORT_OPTIONS: readonly SearchableSelectOption[] = [
  { id: 'recent', label: 'Mais recente' },
  { id: 'oldest', label: 'Mais antigo' }
];

@Component({
  selector: 'app-client-history',
  standalone: true,
  imports: [TermPipe, RouterLink, CustomDropdownDirective, IconComponent, SearchableSelectComponent, ClientStatusBadgeComponent, TenantUrlPipe],
  templateUrl: './client-history.component.html',
  styleUrl: './client-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientHistoryComponent {
  private readonly customerSessions = inject(CustomerSessionService);
  readonly historyService = inject(ClientHistoryService);
  readonly formatService = inject(ClientFormatService);

  readonly feedbackMessage = signal('');
  readonly clientId = computed(() => this.customerSessions.currentCustomer()?.id ?? '');
  readonly records = computed(() => this.historyService.filteredHistory().filter((record) => record.clientId === this.clientId()));
  /** Rolagem infinita: a lista cresce conforme o cliente desce, em vez de renderizar tudo de uma vez. */
  private readonly visibleCount = signal(PAGE_SIZE);
  readonly visibleRecords = computed(() => this.records().slice(0, this.visibleCount()));
  readonly hasMoreRecords = computed(() => this.visibleRecords().length < this.records().length);
  readonly professionals = computed(() => this.historyService.getProfessionals(this.clientId()));
  readonly periodOptions = PERIOD_OPTIONS;
  readonly sortOptions = SORT_OPTIONS;
  readonly professionalOptions = computed<SearchableSelectOption[]>(() => [
    { id: 'all', label: 'Todos' },
    ...this.professionals().map((professional) => ({ id: professional.id, label: professional.name }))
  ]);

  constructor() {
    this.loadHistory();
  }

  /** Carrega do backend os agendamentos concluidos do cliente autenticado. */
  private loadHistory(): void {
    this.historyService.loadHistory().subscribe({
      error: () => this.feedbackMessage.set('Não foi possível carregar seu histórico.')
    });
  }

  /** Atualiza filtros fora do template. */
  updateFilter(name: 'search' | 'period' | 'professionalId' | 'sortOrder', value: string): void {
    this.historyService.updateFilters({ [name]: value });
    // Filtro novo recomeca a lista do topo; manter a contagem antiga mostraria itens demais.
    this.visibleCount.set(PAGE_SIZE);
  }

  /** Carrega o proximo lote quando a pagina chega perto do fim. */
  @HostListener('window:scroll')
  loadMoreNearBottom(): void {
    if (!this.hasMoreRecords()) {
      return;
    }

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - SCROLL_THRESHOLD_PX) {
      this.visibleCount.update((count) => count + PAGE_SIZE);
    }
  }
}
