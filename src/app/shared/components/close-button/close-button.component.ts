import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type CloseButtonTone = 'default' | 'inverse';

/**
 * Botao padrao de fechar modais e paineis laterais: circulo com um X. Usado no painel administrativo,
 * na area do cliente e no site publico, entao as cores tem fallback para os temas que nao definem as
 * variaveis --admin-*. O rotulo acessivel e obrigatorio porque o botao nao tem texto visivel.
 */
@Component({
  selector: 'app-close-button',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="close-button"
      [class.close-button--inverse]="tone() === 'inverse'"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="closeClick.emit()">
      <app-icon name="x" [size]="16" />
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
      }

      .close-button {
        display: inline-grid;
        place-items: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid var(--admin-border, rgba(17, 24, 39, 0.14));
        border-radius: 999px;
        background: var(--admin-surface, #ffffff);
        color: var(--admin-text, #1f2933);
        line-height: 0;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }

      .close-button:hover {
        border-color: var(--admin-text-muted, rgba(17, 24, 39, 0.4));
        background: var(--admin-surface-muted, #f3f4f6);
      }

      .close-button:focus-visible {
        outline: 2px solid var(--admin-primary, #1f2933);
        outline-offset: 2px;
      }

      /* Sobre imagem ou fundo escuro, como a galeria do site publico. */
      .close-button--inverse {
        border-color: rgba(255, 255, 255, 0.45);
        background: rgba(17, 24, 39, 0.55);
        color: #ffffff;
      }

      .close-button--inverse:hover {
        border-color: rgba(255, 255, 255, 0.8);
        background: rgba(17, 24, 39, 0.75);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CloseButtonComponent {
  readonly label = input('Fechar');
  readonly tone = input<CloseButtonTone>('default');

  readonly closeClick = output<void>();
}
