/** A pagina e o perfil da empresa (/{slug}, sem subrota), ignorando query e fragmento. */
export function isCompanyProfileUrl(url: string, profilePath: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path === profilePath.replace(/\/+$/, '');
}
