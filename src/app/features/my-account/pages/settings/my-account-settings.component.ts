import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerSessionService } from '../../../../core/services/customer-session.service';
import { apiErrorMessage } from '../../../../core/utils/api-error-message.util';
import { tooManyAttemptsMessage } from '../../../../core/utils/rate-limit-message.util';
import { matchingPasswordsValidator, phoneNumberValidator } from '../../../auth/register/customer-register.validators';
import { MyAccountDeletionPreview } from '../../models/my-account.model';
import { MyAccountApiService } from '../../services/my-account-api.service';
import { PasswordFieldComponent } from '../../../../shared/components/password-field/password-field.component';

/**
 * Dados da conta em /minha-conta (Fase 4):
 * - nome e celular, so da conta (os cadastros das empresas nao mudam; trocar o celular nunca liga nada);
 * - senha: atual, nova e confirmacao (a atual errada conta como tentativa no bloqueio); conta so com Google pede o
 *   link "Criar uma senha";
 * - e-mail: o link vai para o endereco novo e a troca so vale depois de confirmar; o antigo recebe o "nao fui eu";
 * - excluir a conta: mostra o que acontece (Politica de Privacidade) e pede o e-mail digitado e a senha atual.
 */
@Component({
  selector: 'app-my-account-settings',
  standalone: true,
  imports: [PasswordFieldComponent, ReactiveFormsModule],
  templateUrl: './my-account-settings.component.html',
  styleUrls: ['../../my-account-host.scss', '../../my-account-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccountSettingsComponent {
  private readonly api = inject(MyAccountApiService);
  private readonly customerSessions = inject(CustomerSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = this.customerSessions.account;
  readonly hasPassword = computed(() => this.account()?.hasPassword !== false);

  readonly profileForm = new FormGroup({
    fullName: new FormControl(this.account()?.fullName ?? '', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(160)] }),
    phone: new FormControl(this.account()?.phone ?? '', { nonNullable: true, validators: [Validators.required, phoneNumberValidator()] })
  });
  readonly profileSaving = signal(false);
  readonly profileMessage = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);

  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: matchingPasswordsValidator('newPassword', 'confirmPassword') });
  readonly passwordSaving = signal(false);
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly createPasswordMessage = signal<string | null>(null);

  readonly emailForm = new FormGroup({
    newEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(180)] }),
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });
  readonly emailSaving = signal(false);
  readonly emailMessage = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);

  readonly deletionOpen = signal(false);
  readonly deletionPreview = signal<MyAccountDeletionPreview | null>(null);
  readonly deletionForm = new FormGroup({
    confirmEmail: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    currentPassword: new FormControl('', { nonNullable: true })
  });
  readonly deleting = signal(false);
  readonly deletionError = signal<string | null>(null);

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileSaving()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const { fullName, phone } = this.profileForm.getRawValue();
    this.profileSaving.set(true);
    this.profileMessage.set(null);
    this.profileError.set(null);
    this.api.updateProfile(fullName.trim(), phone.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileMessage.set('Dados salvos. Eles valem para a sua conta; o cadastro em cada empresa continua como a empresa tem.');
      },
      error: (error: unknown) => {
        this.profileSaving.set(false);
        this.profileError.set(apiErrorMessage(error, 'Não foi possível salvar. Tente novamente.'));
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordSaving()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    this.passwordSaving.set(true);
    this.passwordMessage.set(null);
    this.passwordError.set(null);
    this.api.changePassword(currentPassword, newPassword, confirmPassword).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordForm.reset();
        this.passwordMessage.set('Senha trocada. As outras sessões da conta foram encerradas; esta continua aberta.');
      },
      error: (error: unknown) => {
        this.passwordSaving.set(false);
        this.passwordError.set(tooManyAttemptsMessage(error) ?? apiErrorMessage(error, 'Não foi possível trocar a senha. Tente novamente.'));
      }
    });
  }

  /** Conta so com Google: manda o link de redefinicao para o e-mail da conta (o mesmo do "Esqueci minha senha"). */
  createPassword(): void {
    const email = this.account()?.email;
    if (!email) {
      return;
    }

    this.customerSessions.requestPasswordReset(email).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.createPasswordMessage.set(`Enviamos para ${email} um link para criar a senha.`),
      error: (error: unknown) => this.createPasswordMessage.set(tooManyAttemptsMessage(error) ?? 'Não foi possível enviar agora. Tente de novo em alguns minutos.')
    });
  }

  requestEmailChange(): void {
    if (this.emailForm.invalid || this.emailSaving()) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const { newEmail, currentPassword } = this.emailForm.getRawValue();
    this.emailSaving.set(true);
    this.emailMessage.set(null);
    this.emailError.set(null);
    this.api.requestEmailChange(newEmail.trim(), currentPassword).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.emailSaving.set(false);
        this.emailForm.reset();
        this.emailMessage.set(response.message);
      },
      error: (error: unknown) => {
        this.emailSaving.set(false);
        this.emailError.set(tooManyAttemptsMessage(error) ?? apiErrorMessage(error, 'Não foi possível pedir a troca. Tente novamente.'));
      }
    });
  }

  openDeletion(): void {
    this.deletionOpen.set(true);
    this.deletionError.set(null);
    this.api.deletionPreview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => this.deletionPreview.set(preview),
      error: () => this.deletionError.set('Não foi possível carregar os dados da exclusão. Tente novamente.')
    });
  }

  cancelDeletion(): void {
    this.deletionOpen.set(false);
    this.deletionForm.reset();
    this.deletionError.set(null);
  }

  deleteAccount(): void {
    const preview = this.deletionPreview();
    const { confirmEmail, currentPassword } = this.deletionForm.getRawValue();
    if (!preview || this.deleting()) {
      return;
    }

    if (!confirmEmail.trim() || (preview.requiresPassword && !currentPassword)) {
      this.deletionForm.markAllAsTouched();
      this.deletionError.set(preview.requiresPassword ? 'Digite o e-mail da conta e a senha atual.' : 'Digite o e-mail da conta.');
      return;
    }

    this.deleting.set(true);
    this.deletionError.set(null);
    this.api.deleteAccount(confirmEmail.trim(), preview.requiresPassword ? currentPassword : null).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigate(['/entrar'], { queryParams: { 'conta-excluida': 1 } }),
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deletionError.set(tooManyAttemptsMessage(error) ?? apiErrorMessage(error, 'Não foi possível excluir a conta. Tente novamente.'));
      }
    });
  }
}
