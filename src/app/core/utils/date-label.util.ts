/** "2026-11-01" -> "01/11" (dia e mes, sem mexer no fuso); vazio fica "". */
export function formatDayMonth(date: string | null | undefined): string {
  if (!date) {
    return '';
  }

  const [, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}`;
}
