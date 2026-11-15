import { PublicCompanyBusinessHour } from '../models/public-booking-api.model';

export interface BusinessHoursLine {
  /** "Segunda a sexta", "Sábado", "Segunda e terça". */
  readonly days: string;
  /** "09:00 às 19:00 (intervalo 12:00 às 13:00)" ou "Fechado". */
  readonly hours: string;
}

/** Semana a partir de segunda, como se le um horario de funcionamento; o domingo fica no fim. */
const WEEK: readonly { weekday: string; name: string }[] = [
  { weekday: 'Monday', name: 'Segunda' },
  { weekday: 'Tuesday', name: 'Terça' },
  { weekday: 'Wednesday', name: 'Quarta' },
  { weekday: 'Thursday', name: 'Quinta' },
  { weekday: 'Friday', name: 'Sexta' },
  { weekday: 'Saturday', name: 'Sábado' },
  { weekday: 'Sunday', name: 'Domingo' }
];

/**
 * Horario de funcionamento resumido: dias seguidos com o mesmo horario viram uma linha ("Segunda a sexta"). Os nomes dos
 * dias saem daqui (com acento), nao do texto gravado na empresa; o dia da API vem em minusculas ("monday"). Dia sem
 * cadastro nao aparece.
 */
export function summarizeBusinessHours(businessHours: readonly PublicCompanyBusinessHour[]): BusinessHoursLine[] {
  const days = WEEK
    .map((day) => ({ name: day.name, hour: businessHours.find((candidate) => candidate.weekday.toLowerCase() === day.weekday.toLowerCase()) }))
    .filter((day): day is { name: string; hour: PublicCompanyBusinessHour } => day.hour !== undefined)
    .map((day) => ({ name: day.name, hours: hoursText(day.hour), index: WEEK.findIndex((week) => week.name === day.name) }));

  const groups: { names: string[]; hours: string; lastIndex: number }[] = [];
  for (const day of days) {
    const last = groups.at(-1);
    if (last && last.hours === day.hours && last.lastIndex === day.index - 1) {
      last.names.push(day.name);
      last.lastIndex = day.index;
    } else {
      groups.push({ names: [day.name], hours: day.hours, lastIndex: day.index });
    }
  }

  return groups.map((group) => ({ days: daysText(group.names), hours: group.hours }));
}

function hoursText(hour: PublicCompanyBusinessHour): string {
  if (!hour.isOpen) {
    return 'Fechado';
  }

  const pause = hour.hasBreak && hour.breakStartsAt && hour.breakEndsAt ? ` (intervalo ${hour.breakStartsAt} às ${hour.breakEndsAt})` : '';
  return `${hour.startsAt} às ${hour.endsAt}${pause}`;
}

function daysText(names: readonly string[]): string {
  if (names.length === 1) {
    return names[0];
  }

  const last = names.at(-1)!.toLowerCase();
  return names.length === 2 ? `${names[0]} e ${last}` : `${names[0]} a ${last}`;
}
