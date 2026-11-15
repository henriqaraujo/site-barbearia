export interface PublicCompany {
  readonly id: string;
  readonly name: string;
  /** Slug atual da empresa; pode diferir do da URL quando ela veio por um endereco antigo. */
  readonly canonicalSlug: string;
  /** Nome curto, ou o nome quando nao ha nome curto: o backend ja resolve o fallback. */
  readonly displayShortName: string;
  readonly description: string;
  readonly phone: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly instagram: string;
  /** So vem quando e https; site http gravado antes da regra chega null. */
  readonly websiteUrl: string | null;
  readonly address: PublicCompanyAddress;
  readonly branding: PublicCompanyBranding;
  readonly media: readonly PublicCompanyMedia[];
  readonly businessHours: readonly PublicCompanyBusinessHour[];
  readonly timeZoneId: string;
  /** Empresa inativa vem so com a identidade (nome, marca e slug) e sem contato, endereco, midias e horarios. */
  readonly isActive: boolean;
  /** Ramo (null = nao escolhido) e termos dos textos do site; ausentes em respostas antigas. */
  readonly segment?: string | null;
  readonly terms?: { readonly customer: string; readonly customers: string; readonly service: string; readonly services: string } | null;
}

export interface PublicCompanyAddress {
  readonly cep: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
}

export interface PublicCompanyBranding {
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly logoPreviewUrl: string;
  readonly coverPreviewUrl: string;
  readonly faviconUrl: string;
}

export type PublicCompanyMediaSlot =
  | 'LogoPrimary'
  | 'Favicon'
  | 'HeroOpening'
  | 'HeroSalon'
  | 'HeroChairs'
  | 'AboutPrimary'
  | 'AboutDetail'
  | 'RitualBackground'
  | 'GalleryEntrance'
  | 'GalleryChairs'
  | 'GalleryReception'
  | 'GallerySalon'
  | 'GalleryComfort'
  | 'BookingCtaBackground';

export interface PublicCompanyMedia {
  readonly slot: PublicCompanyMediaSlot;
  readonly imageUrl: string;
  readonly fallbackImageUrl: string;
  readonly isConfigured: boolean;
  readonly sortOrder: number;
}

export interface PublicCompanyBusinessHour {
  readonly weekday: string;
  readonly label: string;
  readonly isOpen: boolean;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly hasBreak: boolean;
  readonly breakStartsAt: string;
  readonly breakEndsAt: string;
}

export interface PublicService {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationInMinutes: number;
  readonly price: number;
  readonly imageUrl: string | null;
  readonly requiresDeposit: boolean;
  readonly depositPercentage: number | null;
}

export interface PublicProfessional {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly biography: string | null;
  readonly yearsOfExperience: number;
  readonly serviceIds: readonly string[];
}

export interface PublicServiceProfessional {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly biography: string | null;
  readonly yearsOfExperience: number;
}

export interface PublicAvailability {
  readonly date: string;
  readonly serviceId: string;
  readonly professionalId: string | null;
  readonly timeZoneId: string;
  readonly slots: readonly PublicAvailabilitySlot[];
}

export interface PublicAvailabilitySlot {
  readonly startTime: string;
  readonly endTime: string;
  readonly professionalId: string;
  readonly professionalName: string;
}

export interface CreatePublicAppointmentRequest {
  readonly serviceId: string;
  readonly professionalId: string;
  readonly date: string;
  readonly startTime: string;
  readonly customer: CreatePublicAppointmentCustomerRequest | null;
  readonly notes: string | null;
  readonly useSubscriptionBenefit: boolean;
  /** "Usar resgate" (D15): resgate de servico gratis do cliente logado; o horario sai a R$ 0. */
  readonly loyaltyRedemptionId?: string | null;
  /** "Reagendar" na area do cliente: o horario que sai, cancelado junto com a gravacao do novo. */
  readonly replacesAppointmentId?: string | null;
  /** D7: o preco que a tela mostrou; se mudou no servidor, 409 price-changed e nada e gravado. */
  readonly expectedPrice?: number | null;
}

/** Resgate de servico gratis Solicitado e livre, que o cliente logado pode usar no servico escolhido. */
export interface PublicUsableRedemption {
  readonly id: string;
  readonly rewardName: string;
  readonly serviceId: string;
}

export interface CreatePublicAppointmentCustomerRequest {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
}

export type AppointmentWaitlistPeriod = 'Morning' | 'Afternoon' | 'Any';

export interface CreateAppointmentWaitlistRequest {
  readonly professionalId: string;
  readonly serviceId: string;
  readonly date: string;
  readonly period: AppointmentWaitlistPeriod;
  readonly customer: CreateAppointmentWaitlistCustomerRequest | null;
}

export interface CreateAppointmentWaitlistCustomerRequest {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
}

export interface AppointmentWaitlist {
  readonly id: string;
  readonly professionalId: string;
  readonly professionalName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly desiredDate: string;
  readonly desiredStartTime: string | null;
  readonly desiredEndTime: string | null;
  readonly status: string;
  readonly preferenceLabel: string;
  readonly createdAtUtc: string;
  readonly notifiedAtUtc: string | null;
  readonly completedAtUtc: string | null;
}

/** Resposta da entrada na fila: o token de uso unico para sair sem conta vem so aqui, uma vez (S10). */
export interface CreatedAppointmentWaitlist {
  readonly entry: AppointmentWaitlist;
  readonly cancellationToken: string;
  /** O link tambem foi por e-mail; sem e-mail, a tela mostra o link e pede para guarda-lo. */
  readonly cancellationLinkSentByEmail: boolean;
}

export interface PublicAppointmentConfirmation {
  readonly appointmentId: string;
  readonly confirmationCode: string;
  readonly status: string;
  readonly service: PublicAppointmentServiceConfirmation;
  readonly professional: PublicAppointmentProfessionalConfirmation;
  readonly customer: PublicAppointmentCustomerConfirmation;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly startDateTime: string;
  readonly endDateTime: string;
  readonly timeZoneId: string;
  readonly subscriptionCoverage: PublicSubscriptionBenefitCoverage | null;
}

export interface PublicSubscriptionBenefitCoverage {
  readonly isCovered: boolean;
  readonly planName: string | null;
  readonly availableQuantity: number;
  readonly exclusiveProfessionalId: string | null;
  readonly exclusiveProfessionalName: string | null;
  /** Plano com "Profissionais escolhidos" que nao cobre o profissional pedido: quem atende por ele. */
  readonly allowedProfessionalNames?: readonly string[] | null;
  /** Cliente com plano que nao cobre este horario: por que (o site avisa antes de confirmar, com o valor). */
  readonly uncoveredReason?: SubscriptionCoverageUncoveredReason | null;
  /** Ultimo dia (YYYY-MM-DD) do ciclo do plano que cobre; com dois planos, vale o que termina antes. */
  readonly periodEndDate?: string | null;
  /** Motivo Overdue: vencimento (YYYY-MM-DD) da mensalidade em atraso (N16). */
  readonly overdueInstallmentDate?: string | null;
}

export type SubscriptionCoverageUncoveredReason = 'ProfessionalNotAllowed' | 'LimitReached' | 'OutsideCycle' | 'Overdue';

/** Quem atende pelo plano do cliente no servico; professionalIds null = qualquer profissional. */
export interface PublicSubscriptionCoveringProfessionals {
  readonly hasPlan: boolean;
  readonly planName: string | null;
  readonly professionalIds: readonly string[] | null;
}

export interface PublicAppointmentServiceConfirmation {
  readonly id: string;
  readonly name: string;
  readonly durationInMinutes: number;
  readonly price: number;
  readonly depositAmount: number;
}

export interface PublicAppointmentProfessionalConfirmation {
  readonly id: string;
  readonly name: string;
}

export interface PublicAppointmentCustomerConfirmation {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
}
