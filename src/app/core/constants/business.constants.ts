import { BusinessInformation } from '../models/business-information.model';

/**
 * Estado inicial, antes de a empresa carregar: sem nenhum dado de contato. Endereco, telefone, Instagram, mapa e
 * horario vem so da empresa da URL; o que ela nao cadastrou nao aparece (nunca dado de outra empresa).
 */
export const BUSINESS_INFORMATION: BusinessInformation = {
  // Sem nome provisorio: enquanto a empresa nao carrega, quem mostra o nome exibe esqueleto.
  name: '',
  address: '',
  phone: '',
  instagram: '',
  instagramUrl: '',
  googleMapsUrl: '',
  googleMapsEmbedUrl: '',
  openingHours: []
};

/** Mensagem que abre a conversa do botao de WhatsApp, com o nome cadastrado da empresa quando ja carregou. */
export function whatsappDefaultMessage(companyName: string | null | undefined): string {
  const name = companyName?.trim();
  return name ? `Olá, ${name}! Gostaria de saber mais sobre os serviços.` : 'Olá! Gostaria de saber mais sobre os serviços.';
}
