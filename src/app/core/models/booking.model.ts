import { BarberService } from './service.model';
import { Professional } from './professional.model';

export interface BookingAvailabilitySlot {
  readonly startTime: string;
  readonly endTime: string;
  readonly professionalId: string;
  readonly professionalName: string;
}

export interface BookingCustomer {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly notes: string;
  readonly acceptedCancellationPolicy: boolean;
}

export interface Booking {
  readonly code: string;
  readonly service: BarberService;
  readonly professional: Professional | null;
  readonly date: string;
  readonly time: string;
  readonly endTime: string;
  readonly customer: BookingCustomer;
  readonly subscriptionPlanName: string | null;
  readonly createdAt: string;
}

export interface BookingDraft {
  /** Empresa do rascunho: rascunho de outra empresa nao e restaurado (B-1). */
  readonly companySlug: string;
  readonly selectedServiceId: string | null;
  readonly selectedProfessional: Professional | null;
  readonly allowsAnyProfessional: boolean;
  readonly selectedAvailabilitySlot: BookingAvailabilitySlot | null;
}

export interface BookingSummary {
  readonly serviceName: string;
  readonly professionalName: string;
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly price: number;
}
