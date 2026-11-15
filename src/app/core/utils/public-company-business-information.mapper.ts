import { summarizeBusinessHours } from './business-hours-summary';
import { BusinessInformation } from '../models/business-information.model';
import { PublicCompany, PublicCompanyBusinessHour } from '../models/public-booking-api.model';
import { companyAddressText, companyMapsUrl } from './company-contact-links';

/**
 * Converte os dados publicos da empresa para o modelo visual usado na Home e no Footer. So dados da propria
 * barbearia: o que ela nao cadastrou fica vazio e a tela nao mostra (sem reserva com dado de outra empresa).
 */
export function mapPublicCompanyToBusinessInformation(company: PublicCompany): BusinessInformation {
  const address = companyAddressText(company);

  return {
    name: company.displayShortName,
    address,
    phone: company.phone,
    instagram: company.instagram,
    instagramUrl: formatInstagramUrl(company.instagram),
    googleMapsUrl: companyMapsUrl(company) ?? '',
    googleMapsEmbedUrl: address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : '',
    openingHours: formatBusinessHours(company.businessHours)
  };
}

/** Gera URL do Instagram apenas quando o valor recebido e um perfil simples. */
function formatInstagramUrl(instagram: string): string {
  const profile = instagram.replace('@', '').trim();
  return profile ? `https://www.instagram.com/${encodeURIComponent(profile)}/` : '';
}

/** Horario resumido como no perfil: dias seguidos com o mesmo horario numa linha ("Segunda a sexta: ..."). */
function formatBusinessHours(businessHours: readonly PublicCompanyBusinessHour[]): readonly string[] {
  return summarizeBusinessHours(businessHours).map((line) => `${line.days}: ${line.hours}`);
}
