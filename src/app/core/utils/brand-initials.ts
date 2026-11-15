/** Iniciais do nome da empresa (ate duas palavras), usadas no lugar do logo quando ela nao enviou nenhum. */
export function brandInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
