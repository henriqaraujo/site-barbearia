import { resolveApiMediaUrl } from '../../core/utils/api-media-url.util';
import { MyAccountCompany } from './models/my-account.model';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  Confirmed: 'Confirmado',
  Completed: 'Concluído',
  CancelledByCustomer: 'Cancelado por você',
  CancelledByCompany: 'Cancelado pela empresa',
  NoShow: 'Não compareceu'
};

/** Status do agendamento como a API manda (Confirmed, Completed...) em portugues. */
export function appointmentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Confirmado e concluido em destaque; cancelado e falta em tom neutro. */
export function isActiveStatus(status: string): boolean {
  return status === 'Confirmed' || status === 'Completed';
}

/** "qua., 12/10/2026" a partir de "2026-10-12" (data local da empresa, sem fuso). */
export function formatAppointmentDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Logo da empresa pronto para o <img> (vazio quando a empresa nao enviou: a tela mostra a inicial). */
export function companyLogo(company: MyAccountCompany): string {
  return company.logoUrl ? resolveApiMediaUrl(company.logoUrl) || '' : '';
}

export function companyInitial(company: MyAccountCompany): string {
  return company.name.trim().charAt(0).toUpperCase() || '?';
}
