import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

export interface SearchableSelectOption {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchableSelectComponent {
  private static activeClose: (() => void) | null = null;
  private readonly closeSelf = () => this.close();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;
  @Input() value = '';

  /**
   * Opcoes guardadas num signal: a lista costuma chegar da API depois que o campo ja abriu, e o filtro (computed)
   * precisa recalcular quando ela chega, nao so quando o termo muda.
   */
  @Input() set options(value: readonly SearchableSelectOption[] | null | undefined) {
    this.optionsState.set(value ?? []);
  }

  get options(): readonly SearchableSelectOption[] {
    return this.optionsState();
  }

  private readonly optionsState = signal<readonly SearchableSelectOption[]>([]);

  @Input() placeholder = 'Selecione';
  @Input() emptyText = 'Nenhum resultado encontrado.';
  @Input() ariaLabel = 'Selecionar opção';
  @Input() disabled = false;
  /** Acao opcional no fim da lista aberta (ex.: "Criar nova categoria"); vazio = sem acao. */
  @Input() actionLabel = '';

  /**
   * Busca no servidor: as opcoes ja vem filtradas por quem usa o campo, entao o filtro local nao roda (pesquisar por
   * celular ou e-mail acharia nada se o texto da opcao so tem o nome) e cada digitacao sai em searchChange.
   */
  @Input() serverSearch = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() actionClick = new EventEmitter<void>();

  readonly isOpen = signal(false);
  readonly searchTerm = signal('');
  readonly filteredOptions = computed(() => {
    if (this.serverSearch) {
      return this.options;
    }

    const normalizedTerm = normalizeSearchValue(this.searchTerm());
    return this.options.filter((option) => !normalizedTerm || normalizeSearchValue(option.label).includes(normalizedTerm));
  });

  get inputValue(): string {
    if (this.isOpen()) {
      return this.searchTerm();
    }

    return this.options.find((option) => option.id === this.value)?.label ?? '';
  }

  /** Abre a lista mantendo todas as opcoes visiveis para pesquisa. */
  open(): void {
    if (this.disabled) {
      return;
    }

    SearchableSelectComponent.activeClose?.();
    SearchableSelectComponent.activeClose = this.closeSelf;
    this.searchTerm.set('');
    this.isOpen.set(true);
  }

  /** Alterna a lista ao clicar no proprio campo. */
  toggle(event: Event): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
      return;
    }

    this.open();
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  /** Atualiza o termo pesquisado e filtra as opcoes localmente. */
  updateSearchTerm(event: Event): void {
    if (this.disabled) {
      return;
    }

    SearchableSelectComponent.activeClose?.();
    SearchableSelectComponent.activeClose = this.closeSelf;
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    this.isOpen.set(true);
    if (this.serverSearch) {
      this.searchChange.emit(term);
    }
  }

  /** Seleciona uma opcao e emite apenas o identificador usado pelo formulario. */
  selectOption(option: SearchableSelectOption): void {
    if (option.disabled || this.disabled) {
      return;
    }

    this.valueChange.emit(option.id);
    this.close();
  }

  /** Aciona o item de rodape: fecha a lista e avisa quem usa o campo. */
  runAction(): void {
    if (this.disabled) {
      return;
    }

    this.close();
    this.actionClick.emit();
  }

  /** Setas e Escape dentro da lista: percorre opcoes e acao; Escape fecha e volta o foco ao campo. */
  handlePanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      this.searchInput?.nativeElement.focus();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    const buttons = this.panelButtons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    event.preventDefault();
    if (next) {
      next.focus();
    } else if (event.key === 'ArrowUp') {
      this.searchInput?.nativeElement.focus();
    }
  }

  /** Suporta fechamento por Escape, selecao rapida do primeiro resultado por Enter e seta para baixo para entrar na lista. */
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      if (!this.isOpen()) {
        this.open();
      }

      event.preventDefault();
      queueMicrotask(() => this.panelButtons()[0]?.focus());
      return;
    }

    if (event.key !== 'Enter' || !this.isOpen()) {
      return;
    }

    const firstEnabledOption = this.filteredOptions().find((option) => !option.disabled);
    if (!firstEnabledOption) {
      return;
    }

    event.preventDefault();
    this.selectOption(firstEnabledOption);
  }

  /** Fecha a lista ao clicar fora do componente. */
  @HostListener('document:click')
  closeFromOutside(): void {
    this.close();
  }

  private panelButtons(): HTMLButtonElement[] {
    const panel = this.host.nativeElement.querySelector('.searchable-select__panel');
    return panel ? Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')) : [];
  }

  private close(): void {
    this.searchTerm.set('');
    this.isOpen.set(false);
    if (SearchableSelectComponent.activeClose === this.closeSelf) {
      SearchableSelectComponent.activeClose = null;
    }
  }
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
