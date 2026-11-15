import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Campo de senha com o "olho" para mostrar ou esconder. Embrulha o proprio <input> da tela (projetado), entao
 * formControlName, autocomplete, placeholder e os estados de erro continuam no input de sempre; o componente so
 * troca o type entre password e text. Ao enviar o formulario em que esta, o campo volta a esconder.
 */
@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './password-field.component.html',
  styleUrl: './password-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordFieldComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly visible = signal(false);

  constructor() {
    const onSubmit = () => this.hide();
    const form = this.host.nativeElement.closest('form');
    form?.addEventListener('submit', onSubmit, true);
    inject(DestroyRef).onDestroy(() => form?.removeEventListener('submit', onSubmit, true));
  }

  /** mousedown nao tira o foco do campo: o botao so alterna o type, sem roubar o cursor. */
  keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  toggle(): void {
    this.apply(!this.visible());
  }

  private hide(): void {
    if (this.visible()) {
      this.apply(false);
    }
  }

  private apply(visible: boolean): void {
    this.visible.set(visible);
    this.host.nativeElement.querySelector('input')?.setAttribute('type', visible ? 'text' : 'password');
  }
}
