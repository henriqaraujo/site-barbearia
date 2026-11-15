import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { Booking } from '../../../core/models/booking.model';
import { BarberService } from '../../../core/models/service.model';
import { BookingAvailabilitySlot } from '../../../core/models/booking.model';
import { PublicCompany, PublicSubscriptionBenefitCoverage, PublicUsableRedemption } from '../../../core/models/public-booking-api.model';
import { companyWhatsappUrl } from '../../../core/utils/company-contact-links';
import { BookingSummaryViewModel } from '../models/booking-view-model';
import { createCalendarDateTimeValue, formatDisplayDate } from './booking-calendar.util';

/** Formata valores monetarios do resumo de agendamento. */
export function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface BookingSummaryParams {
  selectedService: BarberService | null;
  professionalName: string;
  selectedDate: string | null;
  selectedAvailabilitySlot: BookingAvailabilitySlot | null;
  paymentSimulation: { message?: string; depositAmount?: number } | null;
  selectedRedemption: PublicUsableRedemption | null;
  useSubscriptionBenefit: boolean;
  subscriptionCoverage: PublicSubscriptionBenefitCoverage | null;
  isFreeOfCharge: boolean;
}

/** Cria o resumo derivado das selecoes sem duplicar regra no template. */
export function createBookingSummary(params: BookingSummaryParams): BookingSummaryViewModel {
  const service = params.selectedService;
  const payment = params.paymentSimulation;

  return {
    temporaryCode: `BD-${new Date().getFullYear()}-PREVIEW`,
    serviceName: service?.name ?? 'Selecione um serviço',
    professionalName: params.professionalName,
    dateLabel: params.selectedDate ? formatDisplayDate(params.selectedDate) : 'Selecione a data',
    time: params.selectedAvailabilitySlot?.startTime ?? 'Selecione o horário',
    duration: service?.duration ?? '-',
    priceLabel: service ? formatPrice(params.isFreeOfCharge ? 0 : service.price) : '-',
    paymentMessage: params.selectedRedemption
      ? `Resgate: ${params.selectedRedemption.rewardName}. Sem custo.`
      : params.useSubscriptionBenefit && params.subscriptionCoverage?.planName
        ? `Coberto pelo ${params.subscriptionCoverage.planName}.`
        : payment?.message ?? 'Pagamento definido após escolher o serviço.',
    depositLabel: params.isFreeOfCharge ? '' : payment?.depositAmount ? `Sinal: ${formatPrice(payment.depositAmount)}` : '',
    subscriptionLabel: params.useSubscriptionBenefit && params.subscriptionCoverage?.planName ? `Coberto pelo ${params.subscriptionCoverage.planName}` : ''
  };
}

/** Monta a URL do Google Calendar usando os dados confirmados pela API. */
export function getCalendarUrl(companyName: string, booking: Booking | null): string {
  if (!booking) {
    return '#';
  }

  const title = encodeURIComponent(`${companyName} - ${booking.service.name}`);
  const startDateTime = createCalendarDateTimeValue(booking.date, booking.time);
  const endDateTime = createCalendarDateTimeValue(booking.date, booking.endTime);
  const details = encodeURIComponent(`Profissional: ${booking.professional?.name ?? 'Primeiro profissional disponível'}%0ACodigo: ${booking.code}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&ctz=${encodeURIComponent(PUBLIC_API_CONFIG.timeZoneId)}&details=${details}`;
}

/**
 * WhatsApp da barbearia da URL com a mensagem do agendamento confirmado. Sem numero cadastrado devolve null e a
 * tela esconde o botao: nunca um numero do build ou de outra empresa.
 */
export function getWhatsappUrl(company: PublicCompany | null, booking: Booking | null): string | null {
  if (!booking) {
    return companyWhatsappUrl(company);
  }

  return companyWhatsappUrl(
    company,
    `Olá, confirmei o agendamento ${booking.code} para ${booking.service.name} com ${booking.professional?.name ?? 'primeiro profissional disponível'} em ${formatDisplayDate(booking.date)} as ${booking.time}.`
  );
}

/** Formata data confirmada pela API para exibicao na tela de sucesso. */
export function getConfirmedBookingDateLabel(booking: Booking): string {
  return formatDisplayDate(booking.date);
}

/** Formata valor confirmado pela API para exibicao na tela de sucesso. */
export function getConfirmedBookingPriceLabel(booking: Booking): string {
  return formatPrice(booking.service.price);
}
