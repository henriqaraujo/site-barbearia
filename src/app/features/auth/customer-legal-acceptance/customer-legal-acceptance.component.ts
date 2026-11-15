import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AcceptedLegalDocument, PendingLegalDocument } from '../../../core/models/auth.model';

/**
 * Aceite dos Termos de Uso e da Politica de Privacidade da conta do cliente (Fase 3): a lista do que falta aceitar,
 * com link para cada documento, e a caixa obrigatoria. Emite os documentos aceitos na versao mostrada.
 */
@Component({
  selector: 'app-customer-legal-acceptance',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './customer-legal-acceptance.component.html',
  // Os campos e o botao seguem o padrao das telas de login (login.component.scss); o resto e desta etapa.
  styleUrls: ['../login/login.component.scss', './customer-legal-acceptance.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerLegalAcceptanceComponent {
  readonly documents = input.required<readonly PendingLegalDocument[]>();
  readonly isSubmitting = input(false);
  readonly submitLabel = input('Continuar');
  readonly accepted = output<AcceptedLegalDocument[]>();
  readonly cancelled = output<void>();

  readonly form = new FormGroup({
    accepted: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.accepted.emit(this.documents().map((document) => ({ id: document.id, version: document.version })));
  }

  documentLink(document: PendingLegalDocument): string {
    return `/${document.id}`;
  }
}
