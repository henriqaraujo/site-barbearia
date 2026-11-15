import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewEncapsulation, inject, input, output, viewChild } from '@angular/core';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { CloseButtonComponent } from '../close-button/close-button.component';
import { IconComponent, IconName } from '../icon/icon.component';

export type ConfirmDialogTone = 'danger' | 'warning' | 'neutral';
export type ConfirmDialogSize = 'sm' | 'md';
/** cancel: foco em Cancelar (padrao, protege acoes destrutivas); field: primeiro campo do corpo, para modais com formulario. */
export type ConfirmDialogInitialFocus = 'cancel' | 'field';

let nextDialogId = 0;

/**
 * Modal padrao de confirmacao: selo com icone no tom da acao, titulo curto, corpo projetado e rodape com
 * Cancelar e a acao principal. Fecha pelo X, pelo fundo e pelo Esc (exceto enquanto a acao roda), e ja abre
 * com o foco em Cancelar para que um Enter distraido nao confirme uma acao destrutiva.
 *
 * Sem encapsulamento de estilo de proposito: o corpo e projetado pela tela que abre o modal, e as pecas
 * de conteudo (.confirm-entity, .confirm-impact) precisam valer ali. Todas as classes tem o prefixo confirm-.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CloseButtonComponent, IconComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent implements AfterViewInit {
  /** Trava a rolagem da pagina enquanto este overlay existir (ID 33). */
  private readonly scrollLock = inject(ScrollLockService).lockUntilDestroyed();

  readonly title = input.required<string>();
  readonly description = input('');
  readonly tone = input<ConfirmDialogTone>('danger');
  readonly icon = input<IconName>('alert-circle');
  readonly confirmLabel = input('Confirmar');
  readonly busyLabel = input('Aguarde...');
  readonly cancelLabel = input('Cancelar');
  readonly busy = input(false);
  /** Erro da confirmacao (a API recusou): aparece no proprio dialogo, que continua aberto (padrao-de-layout.md, 13.10). */
  readonly errorMessage = input<string | null>('');
  /** Desabilita so a acao principal, por exemplo enquanto um campo obrigatorio esta vazio. */
  readonly confirmDisabled = input(false);
  /** Acao intermediaria opcional entre Cancelar e a principal, como Descartar. */
  readonly secondaryLabel = input('');
  readonly size = input<ConfirmDialogSize>('sm');
  readonly initialFocus = input<ConfirmDialogInitialFocus>('cancel');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  readonly secondary = output<void>();

  readonly titleId = `confirm-dialog-title-${++nextDialogId}`;
  readonly descriptionId = `confirm-dialog-description-${nextDialogId}`;

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  ngAfterViewInit(): void {
    const field = this.initialFocus() === 'field'
      ? this.body()?.nativeElement.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])')
      : null;
    (field ?? this.cancelButton()?.nativeElement)?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }

  runSecondary(): void {
    if (!this.busy()) {
      this.secondary.emit();
    }
  }

  confirm(): void {
    if (!this.busy() && !this.confirmDisabled()) {
      this.confirmed.emit();
    }
  }
}
