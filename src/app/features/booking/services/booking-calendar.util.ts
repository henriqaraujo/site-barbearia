import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { BookingAvailabilitySlot } from '../../../core/models/booking.model';
import { PublicAvailabilitySlot } from '../../../core/models/public-booking-api.model';

export interface CalendarDay {
  readonly date: string;
  readonly dayNumber: number;
  readonly isCurrentMonth: boolean;
  readonly isPast: boolean;
  readonly isToday: boolean;
  readonly isUnavailable: boolean;
}

export interface TimeOption {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly professionalId: string;
  readonly professionalName: string;
  readonly label: string;
  readonly isAvailable: boolean;
}

/** Retorna a data atual da empresa em yyyy-MM-dd usando o timezone configurado. */
export function getCurrentCompanyDateValue(timeZoneId: string = PUBLIC_API_CONFIG.timeZoneId): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = dateParts.find((part) => part.type === 'month')?.value ?? '01';
  const day = dateParts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

/** Cria Date local a partir de yyyy-MM-dd sem conversao UTC implicita. */
export function createDateFromDateValue(dateValue: string): Date {
  return new Date(Number(dateValue.slice(0, 4)), Number(dateValue.slice(5, 7)) - 1, Number(dateValue.slice(8, 10)));
}

/** Formata data/hora para URL do Google Calendar no timezone configurado. */
export function createCalendarDateTimeValue(dateValue: string, timeValue: string): string {
  return `${dateValue.replaceAll('-', '')}T${timeValue.replace(':', '')}00`;
}

/** Normaliza uma data para inicio do mes. */
export function createMonthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Formata data como valor ISO simples usado nos botoes do calendario. */
export function formatDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Formata data selecionada para leitura humana no resumo. */
export function formatDisplayDate(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Cria a lista visual de dias; indisponibilidade real vem dos slots da API. */
export function createCalendarDays(visibleMonth: Date, timeZoneId: string = PUBLIC_API_CONFIG.timeZoneId): readonly CalendarDay[] {
  const todayValue = getCurrentCompanyDateValue(timeZoneId);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstGridDay = new Date(firstDay);
  firstGridDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, dayIndex) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + dayIndex);
    const dateValue = formatDateValue(date);
    const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
    const isPast = dateValue < todayValue;

    return {
      date: dateValue,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isPast,
      isToday: dateValue === todayValue,
      isUnavailable: false
    };
  });
}

/** Converte uma opcao visual para o slot persistido no rascunho. */
export function mapTimeOptionToBookingAvailabilitySlot(timeOption: TimeOption): BookingAvailabilitySlot {
  return {
    startTime: timeOption.startTime,
    endTime: timeOption.endTime,
    professionalId: timeOption.professionalId,
    professionalName: timeOption.professionalName
  };
}

/** Converte o slot publico da API para o botao visual de horario. */
export function mapPublicAvailabilitySlotToTimeOption(publicAvailabilitySlot: PublicAvailabilitySlot): TimeOption {
  return {
    id: `${publicAvailabilitySlot.startTime}-${publicAvailabilitySlot.professionalId}`,
    startTime: publicAvailabilitySlot.startTime,
    endTime: publicAvailabilitySlot.endTime,
    professionalId: publicAvailabilitySlot.professionalId,
    professionalName: publicAvailabilitySlot.professionalName,
    label: publicAvailabilitySlot.startTime,
    isAvailable: true
  };
}

/**
 * Monta a lista de horarios exibida. Com "qualquer profissional" a API devolve um slot por
 * profissional livre, o que repetia cada horario na tela e contradizia a promessa de
 * "primeiro horário livre": aqui cada horario aparece uma vez, ja com o primeiro profissional.
 */
export function createTimeOptions(
  slots: readonly PublicAvailabilitySlot[],
  allowsAnyProfessional: boolean,
  isCoveredByPlan: (professionalId: string) => boolean
): TimeOption[] {
  if (!allowsAnyProfessional) {
    return slots.map((slot) => mapPublicAvailabilitySlotToTimeOption(slot));
  }

  const firstSlotByStartTime = new Map<string, PublicAvailabilitySlot>();

  for (const slot of slots) {
    const current = firstSlotByStartTime.get(slot.startTime);
    // Assinante: no mesmo horario, prefere quem atende pelo plano, para o beneficio poder ser usado.
    if (!current || (!isCoveredByPlan(current.professionalId) && isCoveredByPlan(slot.professionalId))) {
      firstSlotByStartTime.set(slot.startTime, slot);
    }
  }

  return [...firstSlotByStartTime.values()].map((slot) => mapPublicAvailabilitySlotToTimeOption(slot));
}
