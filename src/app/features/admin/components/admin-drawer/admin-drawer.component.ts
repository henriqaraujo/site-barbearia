import { animate, style, transition, trigger } from '@angular/animations';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CloseButtonComponent } from '../../../../shared/components/close-button/close-button.component';

@Component({
  selector: 'app-admin-drawer',
  standalone: true,
  imports: [CloseButtonComponent],
  templateUrl: './admin-drawer.component.html',
  styleUrl: './admin-drawer.component.scss',
  animations: [
    trigger('overlayAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease', style({ opacity: 0 }))
      ])
    ]),
    trigger('panelAnimation', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('220ms ease', style({ transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('220ms ease', style({ transform: 'translateX(100%)' }))
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDrawerComponent {
  /** Trava a rolagem da pagina enquanto este overlay existir (ID 33). */
  private readonly scrollLock = inject(ScrollLockService).lockUntilDestroyed();

  @Input({ required: true }) title = '';
  @Input() eyebrow = '';
  @Input() titleId = 'admin-drawer-title';
  @Input() closeAriaLabel = 'Fechar painel lateral';
  /**
   * Erro da acao feita dentro do drawer (salvar, excluir, cancelar...). Fica fixo acima dos botoes: a mensagem do topo
   * da pagina fica escondida atras do drawer (padrao-de-layout.md, 13.10).
   */
  @Input() errorMessage: string | null = '';
  @Output() closed = new EventEmitter<void>();

  /** Emite o fechamento para o componente dono do estado. */
  close(): void {
    this.closed.emit();
  }
}
