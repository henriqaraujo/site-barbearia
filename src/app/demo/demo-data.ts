import { PublicCompany, PublicProfessional, PublicService } from '../core/models/public-booking-api.model';
import { PublicSubscriptionPlan } from '../core/models/public-subscription.model';
import { Product } from '../core/models/product.model';

/** Dados inventados da barbearia de exemplo usada nas apresentacoes. Nada aqui e de um cliente real. */
export const DEMO_COMPANY_SLUG = 'navalha-preta';

// Sem barra inicial: relativo ao base href, para funcionar em /barbearia/ no servidor.
const PHOTOS = 'assets/fotos/apresentacao/';
const INTERIOR = PHOTOS + '466799909_17957726987838563_7070470414627991170_n.jpg';
const RECEPTION = PHOTOS + '485151397_17972504102838563_5528938866140468801_n.jpg';
const CUT = PHOTOS + 'hestory_4.png';
const SERVICE_PHOTO = PHOTOS + 'hestory_5.png';
const SIGN = PHOTOS + 'hestory_8.png';

const media = (slot: PublicCompany['media'][number]['slot'], imageUrl: string, sortOrder: number) =>
  ({ slot, imageUrl, fallbackImageUrl: imageUrl, isConfigured: true, sortOrder });

export const DEMO_COMPANY: PublicCompany = {
  id: '6f1c7a52-0d0b-4c43-9a3e-3e5a8f4d1001',
  name: 'Navalha Preta',
  canonicalSlug: DEMO_COMPANY_SLUG,
  displayShortName: 'Navalha Preta',
  description: 'Barbearia clube em Pinheiros, com atendimento só com hora marcada, toalha quente e navalha.',
  phone: '(11) 94782-3061',
  whatsapp: '(11) 94782-3061',
  email: 'contato@navalhapreta.com.br',
  instagram: '@navalhapreta.barbearia',
  websiteUrl: null,
  address: { cep: '', street: 'Rua Mateus Grou', number: '218', complement: '', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP' },
  branding: { primaryColor: '#24211b', secondaryColor: '#8a6417', accentColor: '#b8862b', logoPreviewUrl: '', coverPreviewUrl: '', faviconUrl: '' },
  media: [
    media('HeroOpening', INTERIOR, 1),
    media('HeroSalon', SERVICE_PHOTO, 2),
    media('HeroChairs', RECEPTION, 3),
    media('AboutPrimary', RECEPTION, 4),
    media('AboutDetail', CUT, 5),
    media('RitualBackground', INTERIOR, 6),
    media('GalleryEntrance', SIGN, 7),
    media('GalleryChairs', INTERIOR, 8),
    media('GalleryReception', RECEPTION, 9),
    media('GallerySalon', SERVICE_PHOTO, 10),
    media('GalleryComfort', CUT, 11),
    media('BookingCtaBackground', INTERIOR, 12)
  ],
  businessHours: [
    ['Monday', 'Segunda', false], ['Tuesday', 'Terça', true], ['Wednesday', 'Quarta', true], ['Thursday', 'Quinta', true],
    ['Friday', 'Sexta', true], ['Saturday', 'Sábado', true], ['Sunday', 'Domingo', false]
  ].map(([weekday, label, isOpen]) => ({
    weekday: weekday as string, label: label as string, isOpen: isOpen as boolean,
    startsAt: label === 'Sábado' ? '08:00' : '09:00', endsAt: label === 'Sábado' ? '18:00' : '20:00',
    hasBreak: false, breakStartsAt: '', breakEndsAt: ''
  })),
  timeZoneId: 'America/Sao_Paulo',
  isActive: true,
  segment: 'Barbershop',
  terms: null
};

const svc = (id: string, name: string, description: string, durationInMinutes: number, price: number): PublicService =>
  ({ id, name, description, durationInMinutes, price, imageUrl: SERVICE_PHOTO, requiresDeposit: false, depositPercentage: null });

export const DEMO_SERVICES: PublicService[] = [
  svc('barba', 'Barba', 'Modelagem de barba com finalização.', 30, 55),
  svc('corte-barba', 'Corte e Barba', 'Combo completo de cabelo e barba.', 60, 115),
  svc('corte-infantil', 'Corte Infantil', 'Corte infantil com cuidado e atenção.', 30, 50),
  svc('corte-masculino', 'Corte Masculino', 'Corte masculino com acabamento preciso.', 45, 70)
];

const pro = (id: string, name: string, biography: string, yearsOfExperience: number, imageUrl: string | null): PublicProfessional =>
  ({ id, name, biography, yearsOfExperience, imageUrl, serviceIds: DEMO_SERVICES.map((s) => s.id) });

export const DEMO_PROFESSIONALS: PublicProfessional[] = [
  pro('davi', 'Davi Prado', 'Especialista em cortes clássicos, acabamento limpo e atendimento objetivo.', 9, CUT),
  pro('bia', 'Bia Contreras', 'Atua com degradê, barba alinhada e cortes modernos para rotina intensa.', 6, SERVICE_PHOTO),
  pro('lucas', 'Lucas Amaral', 'Foco em barba, visagismo e atendimento cuidadoso.', 7, null)
];

const product = (id: string, name: string, category: string, description: string, price: number): Product =>
  ({ id, name, category, description, price, imageUrl: PHOTOS + 'pomada_cabelo.png' });

export const DEMO_PRODUCTS: Product[] = [
  product('p1', 'Balm de barba', 'Barba', 'Hidratação diária para alinhar e amaciar a barba.', 47),
  product('p2', 'Pomada matte', 'Cabelo', 'Fixação forte e acabamento seco com visual natural.', 58),
  product('p3', 'Pomada brilho', 'Cabelo', 'Base d’água com brilho alto, sai com um enxágue.', 52),
  product('p4', 'Cera de bigode', 'Barba', 'Cera firme em lata pequena para o dia a dia.', 34)
];

export const DEMO_PLANS: PublicSubscriptionPlan[] = [
  { id: 'fio', name: 'Fio', description: 'Para quem corta toda quinzena.', price: 109, billingPeriod: 'Monthly', isFeatured: false, displayOrder: 1,
    benefits: [{ serviceId: 'corte-masculino', serviceName: 'Cortes masculinos', quantityPerPeriod: 2 }] },
  { id: 'navalha', name: 'Navalha', description: 'Corte e barba sem contar as visitas.', price: 189, billingPeriod: 'Monthly', isFeatured: true, displayOrder: 2,
    benefits: [{ serviceId: 'corte-masculino', serviceName: 'Cortes masculinos', quantityPerPeriod: 2 }, { serviceId: 'barba', serviceName: 'Barbas', quantityPerPeriod: 2 }] },
  { id: 'preta', name: 'Preta', description: 'A cadeira reservada para você.', price: 299, billingPeriod: 'Monthly', isFeatured: false, displayOrder: 3,
    benefits: [{ serviceId: 'corte-barba', serviceName: 'Corte e Barba', quantityPerPeriod: 4 }] }
];
