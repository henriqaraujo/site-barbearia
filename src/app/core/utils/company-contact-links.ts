import { PublicCompany } from '../models/public-booking-api.model';

type CompanyContact = Pick<PublicCompany, 'whatsapp' | 'phone'>;
type CompanyAddress = Pick<PublicCompany, 'address'>;

const BRAZIL_COUNTRY_CODE = '55';

/**
 * Numero da barbearia no formato do wa.me: so digitos, WhatsApp cadastrado ou, sem ele, o telefone. O cadastro
 * guarda DDD + numero (10 ou 11 digitos), e o wa.me exige o codigo do pais, entao o 55 entra quando falta.
 * Sem numero, devolve vazio: a tela esconde o botao em vez de apontar para outro numero.
 */
export function companyWhatsappNumber(company: CompanyContact | null): string {
  const digits = (company?.whatsapp || company?.phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `${BRAZIL_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

/** Link do WhatsApp da barbearia, com mensagem opcional; null quando ela nao tem numero. */
export function companyWhatsappUrl(company: CompanyContact | null, message?: string): string | null {
  const whatsappNumber = companyWhatsappNumber(company);
  if (!whatsappNumber) {
    return null;
  }

  return message ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : `https://wa.me/${whatsappNumber}`;
}

/** Endereco publico da barbearia em uma linha, so com as partes preenchidas; vazio quando nao ha endereco. */
export function companyAddressText(company: CompanyAddress | null): string {
  if (!company) {
    return '';
  }

  const { street, number, complement, neighborhood, city, state, cep } = company.address;
  return [joinParts(street, number, ', '), complement, neighborhood, joinParts(city, state, ' - '), cep].filter(Boolean).join(', ');
}

/** "Como chegar" pelo endereco da barbearia; null quando ela nao tem endereco. */
export function companyMapsUrl(company: CompanyAddress | null): string | null {
  const address = companyAddressText(company);
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

/** Junta duas partes do endereco preservando o que existir de cada uma. */
function joinParts(first: string, second: string, separator: string): string {
  return first && second ? `${first}${separator}${second}` : first || second;
}
