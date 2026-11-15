/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** Quem atende pelo plano, para o cliente: os nomes da regra "Profissionais escolhidos" ou "Qualquer profissional". */
export function describePlanProfessionals(professionalNames: readonly string[] | null | undefined): string {
  return professionalNames?.length ? joinNames(professionalNames) : 'Qualquer profissional';
}
