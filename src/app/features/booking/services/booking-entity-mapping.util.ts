import { Booking, BookingAvailabilitySlot, BookingCustomer } from '../../../core/models/booking.model';
import { Professional } from '../../../core/models/professional.model';
import {
  AppointmentWaitlistPeriod,
  CreateAppointmentWaitlistRequest,
  CreatePublicAppointmentRequest,
  PublicAppointmentConfirmation,
  PublicProfessional,
  PublicService,
  PublicServiceProfessional
} from '../../../core/models/public-booking-api.model';
import { BarberService } from '../../../core/models/service.model';
import { resolveApiMediaUrl } from '../../../core/utils/api-media-url.util';

export const DEFAULT_SERVICE_IMAGE_URL = '/assets/fotos/placeholder-ambiente.svg';

export interface AppointmentCustomerDraft {
  readonly fullName: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly notes?: string | null;
  readonly acceptedCancellationPolicy?: boolean;
}

export interface CreateAppointmentRequestOptions {
  readonly service: BarberService;
  readonly selectedDate: string;
  readonly selectedAvailabilitySlot: BookingAvailabilitySlot;
  readonly customer: AppointmentCustomerDraft;
  readonly isAuthenticatedCustomer: boolean;
  readonly useSubscriptionBenefit: boolean;
  readonly selectedRedemptionId?: string | null;
  readonly isMemberCustomer: boolean;
  readonly replacingAppointmentId?: string | null;
}

/** Converte o DTO de servico publico para o modelo visual usado no agendamento. */
export function mapPublicServiceToBarberService(publicService: PublicService): BarberService {
  return {
    id: publicService.id,
    name: publicService.name,
    description: publicService.description ?? '',
    duration: `${publicService.durationInMinutes} minutos`,
    durationMinutes: publicService.durationInMinutes,
    price: publicService.price,
    imageUrl: resolveApiMediaUrl(publicService.imageUrl) || DEFAULT_SERVICE_IMAGE_URL
  };
}

/** Converte o DTO de profissional publico para o modelo visual usado no agendamento. */
export function mapPublicProfessionalToProfessional(
  publicProfessional: PublicProfessional | PublicServiceProfessional
): Professional {
  return {
    id: publicProfessional.id,
    name: publicProfessional.name,
    specialty: 'Profissional',
    description: publicProfessional.biography ?? '',
    yearsOfExperience: publicProfessional.yearsOfExperience,
    photoUrl: publicProfessional.imageUrl,
    socialNetworks: []
  };
}

/** Retorna o nome efetivo do profissional, incluindo slots de qualquer profissional. */
export function createEffectiveProfessionalName(
  selectedProfessional: Professional | null,
  selectedAvailabilitySlot: BookingAvailabilitySlot | null,
  allowsAnyProfessional: boolean
): string {
  return selectedProfessional?.name
    ?? selectedAvailabilitySlot?.professionalName
    ?? (allowsAnyProfessional ? 'Primeiro profissional disponível' : 'Selecione um profissional');
}

/** Cria um profissional efetivo quando o slot veio da opcao qualquer profissional. */
export function createEffectiveProfessional(
  selectedProfessional: Professional | null,
  selectedAvailabilitySlot: BookingAvailabilitySlot | null
): Professional | null {
  if (selectedProfessional) {
    return selectedProfessional;
  }

  if (!selectedAvailabilitySlot) {
    return null;
  }

  return {
    id: selectedAvailabilitySlot.professionalId,
    name: selectedAvailabilitySlot.professionalName,
    specialty: 'Profissional',
    description: '',
    yearsOfExperience: 0,
    photoUrl: null,
    socialNetworks: []
  };
}

/** Cria o servico confirmado usando preco e duracao retornados pela API. */
export function createConfirmedService(
  appointmentConfirmation: PublicAppointmentConfirmation,
  knownServices: readonly BarberService[]
): BarberService {
  const knownService = knownServices.find((service) => service.id === appointmentConfirmation.service.id);

  return {
    id: appointmentConfirmation.service.id,
    name: appointmentConfirmation.service.name,
    description: knownService?.description ?? '',
    duration: `${appointmentConfirmation.service.durationInMinutes} minutos`,
    durationMinutes: appointmentConfirmation.service.durationInMinutes,
    price: appointmentConfirmation.service.price,
    imageUrl: knownService?.imageUrl ?? DEFAULT_SERVICE_IMAGE_URL
  };
}

/** Cria o profissional confirmado reaproveitando foto/dados locais quando ja estao carregados. */
export function createConfirmedProfessional(
  appointmentConfirmation: PublicAppointmentConfirmation,
  knownProfessionals: readonly Professional[]
): Professional {
  const knownProfessional = knownProfessionals.find((professional) => professional.id === appointmentConfirmation.professional.id);

  if (knownProfessional) {
    return {
      ...knownProfessional,
      name: appointmentConfirmation.professional.name
    };
  }

  return {
    id: appointmentConfirmation.professional.id,
    name: appointmentConfirmation.professional.name,
    specialty: 'Profissional',
    description: '',
    yearsOfExperience: 0,
    photoUrl: null,
    socialNetworks: []
  };
}

/** Cria o payload do POST usando o profissional exato retornado no slot de disponibilidade. */
export function createAppointmentRequest(options: CreateAppointmentRequestOptions): CreatePublicAppointmentRequest {
  return {
    serviceId: options.service.id,
    professionalId: options.selectedAvailabilitySlot.professionalId,
    date: options.selectedDate,
    startTime: options.selectedAvailabilitySlot.startTime,
    customer: options.isAuthenticatedCustomer ? null : {
      name: options.customer.fullName,
      phone: options.customer.phone,
      email: options.customer.email || null
    },
    notes: options.customer.notes || null,
    useSubscriptionBenefit: options.useSubscriptionBenefit,
    expectedPrice: options.service.price,
    ...(options.selectedRedemptionId ? { loyaltyRedemptionId: options.selectedRedemptionId } : {}),
    ...(options.isMemberCustomer && options.replacingAppointmentId ? { replacesAppointmentId: options.replacingAppointmentId } : {})
  };
}

/** Converte a confirmacao da API no modelo visual da tela de sucesso. */
export function mapAppointmentConfirmationToBooking(
  appointmentConfirmation: PublicAppointmentConfirmation,
  confirmedService: BarberService,
  confirmedProfessional: Professional,
  notes?: string | null,
  acceptedCancellationPolicy?: boolean
): Booking {
  return {
    code: appointmentConfirmation.confirmationCode,
    service: confirmedService,
    professional: confirmedProfessional,
    date: appointmentConfirmation.date,
    time: appointmentConfirmation.startTime,
    endTime: appointmentConfirmation.endTime,
    customer: {
      fullName: appointmentConfirmation.customer.name,
      phone: appointmentConfirmation.customer.phone,
      email: appointmentConfirmation.customer.email ?? '',
      notes: notes ?? '',
      acceptedCancellationPolicy: acceptedCancellationPolicy ?? false
    },
    subscriptionPlanName: appointmentConfirmation.subscriptionCoverage?.planName ?? null,
    createdAt: new Date().toISOString()
  };
}

/** Monta o payload da fila com o cliente do formulario publico atual. */
export function createWaitlistRequest(
  serviceId: string,
  professionalId: string,
  selectedDate: string,
  period: AppointmentWaitlistPeriod,
  customer: AppointmentCustomerDraft,
  isAuthenticatedCustomer: boolean
): CreateAppointmentWaitlistRequest {
  return {
    serviceId,
    professionalId,
    date: selectedDate,
    period,
    customer: isAuthenticatedCustomer ? null : {
      name: customer.fullName,
      phone: customer.phone,
      email: customer.email || null
    }
  };
}
