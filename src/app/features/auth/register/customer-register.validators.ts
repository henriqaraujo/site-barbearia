import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Valida telefone brasileiro usando apenas os digitos informados. */
export function phoneNumberValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const digits = control.value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13 ? null : { phone: true };
  };
}

/** Confere se senha e confirmacao possuem o mesmo valor. */
export function matchingPasswordsValidator(passwordControlName: string, confirmPasswordControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordControlName)?.value;
    const confirmPassword = control.get(confirmPasswordControlName)?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}
