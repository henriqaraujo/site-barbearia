import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../../../core/config/public-api.config';
import { AuthenticatedUser } from '../../../core/models/auth.model';
import { Booking, BookingAvailabilitySlot, BookingCustomer } from '../../../core/models/booking.model';
import { Professional } from '../../../core/models/professional.model';
import { AppointmentWaitlistPeriod, CreatedAppointmentWaitlist, CreateAppointmentWaitlistRequest, CreatePublicAppointmentRequest, PublicAppointmentConfirmation, PublicAvailability, PublicAvailabilitySlot, PublicProfessional, PublicService, PublicServiceProfessional, PublicSubscriptionBenefitCoverage, PublicSubscriptionCoveringProfessionals, PublicUsableRedemption } from '../../../core/models/public-booking-api.model';
import { BarberService } from '../../../core/models/service.model';
import { BookingStorageService } from '../../../core/services/booking-storage.service';
import { CustomerSessionService } from '../../../core/services/customer-session.service';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { PublicBookingApiService } from '../../../core/services/public-booking-api.service';
import { getPaymentSimulation } from '../../../core/utils/booking-payment.util';
import { buildWaitlistCancellationUrl } from '../../../core/utils/link-token.util';
import { joinNames } from '../../../core/utils/plan-professionals.util';
import { ToastService } from '../../../shared/services/toast.service';
import { BookingSummaryViewModel } from '../models/booking-view-model';

import {
  CalendarDay,
  TimeOption,
  createCalendarDays,
  createMonthStartDate,
  formatDateValue,
  formatDisplayDate,
  getCurrentCompanyDateValue,
  createDateFromDateValue,
  createCalendarDateTimeValue,
  mapTimeOptionToBookingAvailabilitySlot,
  mapPublicAvailabilitySlotToTimeOption,
  createTimeOptions
} from './booking-calendar.util';

export type { CalendarDay, TimeOption };

import {
  createBookingSummary,
  formatPrice,
  getCalendarUrl,
  getWhatsappUrl,
  getConfirmedBookingDateLabel,
  getConfirmedBookingPriceLabel
} from './booking-summary.util';

import {
  isCoveredByPlan,
  sortPlanProfessionalsFirst,
  getUncoveredWarning,
  resolvePlanCoverageState,
  isFreeOfCharge
} from './booking-plan-benefits.util';

import {
  mapPublicServiceToBarberService,
  mapPublicProfessionalToProfessional,
  createEffectiveProfessionalName,
  createEffectiveProfessional,
  createConfirmedService,
  createConfirmedProfessional,
  createAppointmentRequest,
  mapAppointmentConfirmationToBooking,
  createWaitlistRequest
} from './booking-entity-mapping.util';

import {
  parseAppointmentError,
  parseWaitlistError,
  isEmailConfirmationRequired,
  conflictMessage
} from './booking-error-handler.util';

@Injectable({ providedIn: 'root' })
export class BookingStateService {
  readonly services = signal<readonly BarberService[]>([]);
  readonly professionals = signal<readonly Professional[]>([]);
  /**
   * Quem atende pelo plano do cliente logado no servico escolhido: null = sem plano (ou anonimo), 'any' = qualquer
   * profissional, Set = so esses. Os cobertos aparecem primeiro e com o selo do plano.
   */
  readonly planProfessionalIds = signal<ReadonlySet<string> | 'any' | null>(null);
  readonly planName = signal<string | null>(null);
  readonly timeOptions = signal<readonly TimeOption[]>([]);
  readonly isLoadingServices = signal(false);
  readonly isLoadingProfessionals = signal(false);
  readonly isLoadingAvailability = signal(false);
  readonly servicesErrorMessage = signal('');
  readonly professionalsErrorMessage = signal('');
  readonly availabilityErrorMessage = signal('');
  readonly appointmentErrorMessage = signal('');
  readonly subscriptionCoverage = signal<PublicSubscriptionBenefitCoverage | null>(null);
  readonly isLoadingSubscriptionCoverage = signal(false);
  readonly useSubscriptionBenefit = signal(false);
  /** "Usar resgate" (D15): resgates de servico gratis do cliente para o servico escolhido e o que ele marcou. */
  readonly usableRedemptions = signal<PublicUsableRedemption[]>([]);
  readonly selectedRedemption = signal<PublicUsableRedemption | null>(null);
  readonly waitlistErrorMessage = signal('');
  readonly selectedService = signal<BarberService | null>(null);
  readonly selectedProfessional = signal<Professional | null>(null);
  readonly allowsAnyProfessional = signal(false);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedTime = signal<string | null>(null);
  readonly selectedAvailabilitySlot = signal<BookingAvailabilitySlot | null>(null);
  readonly visibleMonth = signal(this.createMonthStartDate(new Date()));
  readonly savedBooking = signal<Booking | null>(null);
  /** Janela de confirmacao do agendamento: abre no sucesso (visivel tambem no celular, sem rolar) e fecha pelo usuario. */
  readonly confirmationDialogOpen = signal(false);
  /** "Reagendar" da area do cliente (?remarcar=): o horario que sai; vale so com o cliente logado. */
  readonly replacingAppointmentId = signal<string | null>(null);
  readonly savedWaitlistEntry = signal<CreatedAppointmentWaitlist | null>(null);
  /** Link para sair da fila depois de fechar a pagina, mostrado so a quem nao recebeu o link por e-mail (S10). */
  readonly waitlistCancellationUrl = computed(() => {
    const savedEntry = this.savedWaitlistEntry();
    return savedEntry && !savedEntry.cancellationLinkSentByEmail
      ? buildWaitlistCancellationUrl(this.document.location.origin, this.companyContextService.companySlug(), savedEntry.cancellationToken)
      : null;
  });
  readonly isSubmitting = signal(false);
  readonly isSubmittingWaitlist = signal(false);
  readonly selectedWaitlistPeriod = signal<AppointmentWaitlistPeriod>('Any');
  readonly isMobileSummaryOpen = signal(false);
  private readonly customerSessions = inject(CustomerSessionService);
  /**
   * Quem agenda logado (conta unica, Fase 3): o cliente desta empresa (vinculo conferido) ou, sem vinculo ainda, a
   * propria conta com celular (o servidor cria ou liga o vinculo ao agendar, item 7). Conta sem celular (feita pelo
   * Google) preenche o formulario como visitante e o servidor usa o celular informado.
   */
  readonly authenticatedCustomer = computed<AuthenticatedUser | null>(() => {
    const member = this.customerSessions.currentCustomer();
    if (member) {
      return member;
    }

    const account = this.customerSessions.account();
    return account?.phone ? { id: '', name: account.fullName, email: account.email, phone: account.phone, role: 'client' } : null;
  });
  /** Conta logada que ainda nao confirmou o e-mail e tem cadastro com o mesmo e-mail nesta empresa (item 7, regra 3). */
  readonly emailConfirmationMessage = signal('');
  readonly emailConfirmationFeedback = signal('');
  readonly isAuthenticatedCustomer = computed(() => Boolean(this.authenticatedCustomer()));
  /** Plano, resgates e reagendamento sao do cliente desta empresa: so com vinculo (a conta sem vinculo ainda nao tem). */
  private readonly isMemberCustomer = computed(() => Boolean(this.customerSessions.currentCustomer()));
  readonly customerForm = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    email: ['', [Validators.email]],
    notes: [''],
    acceptedCancellationPolicy: [false, [Validators.requiredTrue]]
  });
  readonly isCustomerFormValid = toSignal(this.customerForm.statusChanges.pipe(
    startWith(this.customerForm.status),
    map(() => this.customerForm.valid)
  ), { initialValue: this.customerForm.valid });
  readonly monthLabel = computed(() => this.visibleMonth().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  readonly calendarDays = computed(() => this.createCalendarDays(this.visibleMonth()));
  readonly paymentSimulation = computed(() => {
    const service = this.selectedService();
    return service ? getPaymentSimulation(this.isFreeOfCharge() ? 0 : service.price) : null;
  });
  readonly canConfirmBooking = computed(() => Boolean(this.selectedService()) && (Boolean(this.selectedProfessional()) || this.allowsAnyProfessional()) && Boolean(this.selectedDate()) && Boolean(this.selectedAvailabilitySlot()) && this.isCustomerFormValid() && !this.isSubmitting());
  readonly canJoinWaitlist = computed(() => Boolean(this.selectedService()) && Boolean(this.selectedProfessional()) && Boolean(this.selectedDate()) && this.timeOptions().length === 0 && this.isCustomerFormValid() && !this.isSubmittingWaitlist());
  readonly shouldShowWaitlist = computed(() => Boolean(this.selectedService()) && Boolean(this.selectedProfessional()) && Boolean(this.selectedDate()) && !this.isLoadingAvailability() && !this.availabilityErrorMessage() && this.timeOptions().length === 0 && !this.savedWaitlistEntry());
  readonly summary = computed<BookingSummaryViewModel>(() => this.createBookingSummary());
  private readonly bookingStorageService = inject(BookingStorageService);
  private readonly publicBookingApiService = inject(PublicBookingApiService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly document = inject(DOCUMENT);
  private readonly toastService = inject(ToastService);
  private readonly selectedServiceRequests = new Subject<BarberService>();
  private readonly availabilityRequests = new Subject<void>();
  /** Encerra as consultas em andamento da empresa anterior: resposta atrasada de A nao preenche a tela de B (B-1). */
  private readonly companyChanges = new Subject<void>();
  private allServices: readonly BarberService[] = [];
  private routeProfessionalServiceIds: readonly string[] | null = null;
  private pendingInitialServiceId: string | null = null;
  private pendingInitialProfessionalId: string | null = null;
  private lastKnownAuthIdentity: string | undefined;
  /** Empresa de quem sao o catalogo e as selecoes guardadas; o estado e singleton e vive alem da troca de empresa. */
  private catalogCompanySlug = this.companyContextService.companySlug();

  constructor() {
    this.restoreDraftSelection();
    this.registerAuthenticatedCustomerFormRules();
    this.registerCustomerIdentityResetRule();
    this.loadServices();
    this.registerServiceSelectionListener();
    this.registerAvailabilitySelectionListener();
  }

  /**
   * Garante que catalogo e selecoes sao da empresa da URL (B-1). Ao abrir /{slug}/agendamento de outra empresa, nada
   * da anterior fica: limpa selecoes, profissionais e rascunho e recarrega os servicos. Na mesma empresa nao faz nada.
   * A tela chama isto antes de aplicar servico ou profissional vindos da URL.
   */
  ensureCompany(): void {
    const companySlug = this.companyContextService.companySlug();

    if (companySlug === this.catalogCompanySlug) {
      return;
    }

    this.catalogCompanySlug = companySlug;
    this.companyChanges.next();
    this.resetBooking();
    this.allServices = [];
    this.services.set([]);
    this.servicesErrorMessage.set('');
    this.loadServices();
  }

  /** Limpa selecoes, confirmacao e formulario do agendamento atual sem afetar sessao ou catalogo da empresa. */
  resetBooking(): void {
    this.savedBooking.set(null);
    this.confirmationDialogOpen.set(false);
    this.replacingAppointmentId.set(null);
    this.savedWaitlistEntry.set(null);
    this.selectedService.set(null);
    this.selectedProfessional.set(null);
    this.allowsAnyProfessional.set(false);
    this.selectedDate.set(null);
    this.selectedTime.set(null);
    this.selectedAvailabilitySlot.set(null);
    this.timeOptions.set([]);
    this.professionals.set([]);
    this.visibleMonth.set(this.createMonthStartDate(new Date()));
    this.isSubmitting.set(false);
    this.isSubmittingWaitlist.set(false);
    this.isMobileSummaryOpen.set(false);
    this.selectedWaitlistPeriod.set('Any');
    this.appointmentErrorMessage.set('');
    this.availabilityErrorMessage.set('');
    this.professionalsErrorMessage.set('');
    this.waitlistErrorMessage.set('');
    this.clearSubscriptionBenefitSelection();
    this.routeProfessionalServiceIds = null;
    this.pendingInitialServiceId = null;
    this.pendingInitialProfessionalId = null;
    this.customerForm.reset({
      fullName: '',
      phone: '',
      email: '',
      notes: '',
      acceptedCancellationPolicy: false
    });
    this.bookingStorageService.clearBookingDraft();
  }

  /** Aplica servico ou profissional recebidos por query string depois que a API retorna os dados. */
  applyInitialSelections(serviceId: string | null, professionalId: string | null, date: string | null = null, replacingAppointmentId: string | null = null): void {
    if (replacingAppointmentId && /^[0-9a-f-]{36}$/i.test(replacingAppointmentId)) {
      this.replacingAppointmentId.set(replacingAppointmentId);
    }

    if (serviceId) {
      this.pendingInitialServiceId = serviceId;
    }

    if (professionalId) {
      this.pendingInitialProfessionalId = professionalId;
      this.allowsAnyProfessional.set(false);
    }

    if (professionalId && !serviceId) {
      this.loadProfessionalsForInitialSelection();
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.selectedDate.set(date);
      this.visibleMonth.set(this.createMonthStartDate(this.createDateFromDateValue(date)));
    }

    this.applyPendingInitialServiceSelection();
  }

  /** Carrega novamente os servicos publicos quando o usuario solicita uma nova tentativa. */
  retryLoadServices(): void {
    this.loadServices();
  }

  /** Carrega novamente os profissionais vinculados ao servico selecionado. */
  retryLoadProfessionals(): void {
    const service = this.selectedService();

    if (service) {
      this.selectedServiceRequests.next(service);
    }
  }

  /** Carrega novamente os horarios disponiveis da data selecionada. */
  retryLoadAvailability(): void {
    this.requestAvailabilityWhenReady();
  }

  /** Seleciona o servico escolhido, limpa data/horario e busca profissionais vinculados. */
  selectService(service: BarberService): void {
    this.selectedService.set(service);
    this.professionals.set([]);
    this.savedWaitlistEntry.set(null);
    this.waitlistErrorMessage.set('');
    this.clearSelectedDateAndTime();
    this.clearSubscriptionBenefitSelection();
    this.saveDraftSelection();
    this.selectedServiceRequests.next(service);
  }

  /** Seleciona um profissional especifico, limpa horario antigo e recarrega disponibilidade. */
  selectProfessional(professional: Professional): void {
    this.clearRouteProfessionalServiceFilter();
    this.allowsAnyProfessional.set(false);
    this.selectedProfessional.set(professional);
    this.savedWaitlistEntry.set(null);
    this.waitlistErrorMessage.set('');
    this.clearSelectedTime();
    this.clearSubscriptionBenefitSelection();
    this.saveDraftSelection();
    this.requestAvailabilityWhenReady();
  }

  /** Seleciona o primeiro profissional disponivel e recarrega disponibilidade sem professionalId. */
  selectAnyProfessional(): void {
    this.clearRouteProfessionalServiceFilter();
    this.selectedProfessional.set(null);
    this.allowsAnyProfessional.set(true);
    this.savedWaitlistEntry.set(null);
    this.waitlistErrorMessage.set('');
    this.clearSelectedTime();
    this.clearSubscriptionBenefitSelection();
    this.saveDraftSelection();
    this.requestAvailabilityWhenReady();
  }

  /** Avanca um mes no calendario demonstrativo. */
  showNextMonth(): void {
    this.visibleMonth.update((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  }

  /** Retorna um mes no calendario sem permitir navegacao antes do mes atual. */
  showPreviousMonth(): void {
    const previousMonth = new Date(this.visibleMonth().getFullYear(), this.visibleMonth().getMonth() - 1, 1);
    const currentMonth = this.createMonthStartDate(this.createDateFromDateValue(this.getCurrentCompanyDateValue()));

    if (previousMonth >= currentMonth) {
      this.visibleMonth.set(previousMonth);
    }
  }

  /** Seleciona uma data habilitada e carrega horarios reais da API. */
  selectDate(calendarDay: CalendarDay): void {
    if (calendarDay.isPast || calendarDay.isUnavailable || !calendarDay.isCurrentMonth) {
      return;
    }

    this.selectedDate.set(calendarDay.date);
    this.savedWaitlistEntry.set(null);
    this.waitlistErrorMessage.set('');
    this.clearSelectedTime();
    this.clearSubscriptionBenefitSelection();
    this.saveDraftSelection();
    this.requestAvailabilityWhenReady();
  }

  /** Atualiza a preferencia visual da fila de espera. */
  selectWaitlistPeriod(period: AppointmentWaitlistPeriod): void {
    this.selectedWaitlistPeriod.set(period);
    this.waitlistErrorMessage.set('');
  }

  /** Cria entrada na fila de espera quando o dia nao possui slots disponiveis. */
  joinWaitlist(): void {
    const service = this.selectedService();
    const professional = this.selectedProfessional();
    const selectedDate = this.selectedDate();

    if (this.isSubmittingWaitlist()) {
      return;
    }

    if (!service || !professional || !selectedDate || !this.canJoinWaitlist()) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.isSubmittingWaitlist.set(true);
    this.waitlistErrorMessage.set('');

    this.publicBookingApiService.createWaitlistEntry(this.companyContextService.companySlug(), this.createWaitlistRequest(service.id, professional.id, selectedDate)).pipe(
      finalize(() => this.isSubmittingWaitlist.set(false))
    ).subscribe({
      next: (waitlistEntry) => {
        this.refreshMembershipAfterAction();
        this.savedWaitlistEntry.set(waitlistEntry);
      },
      error: (error: unknown) => this.handleCreateWaitlistError(error)
    });
  }

  /** Cancela localmente e no backend a fila confirmada nesta tela. */
  leaveWaitlist(): void {
    const waitlistEntry = this.savedWaitlistEntry();

    if (!waitlistEntry || this.isSubmittingWaitlist()) {
      return;
    }

    this.isSubmittingWaitlist.set(true);
    this.waitlistErrorMessage.set('');

    this.publicBookingApiService.leaveWaitlist(this.companyContextService.companySlug(), waitlistEntry.cancellationToken).pipe(
      finalize(() => this.isSubmittingWaitlist.set(false))
    ).subscribe({
      next: () => this.savedWaitlistEntry.set(null),
      error: () => this.waitlistErrorMessage.set('Não foi possível sair da fila agora. Tente novamente em instantes.')
    });
  }

  /** Seleciona um horario retornado pela API de disponibilidade. */
  selectTime(timeOption: TimeOption): void {
    if (!timeOption.isAvailable) {
      return;
    }

    this.selectedTime.set(timeOption.startTime);
    this.selectedAvailabilitySlot.set(this.mapTimeOptionToBookingAvailabilitySlot(timeOption));
    this.loadSubscriptionCoverage();
    this.saveDraftSelection();
  }

  /** Alterna uso do beneficio quando ha saldo disponivel para o slot escolhido. Plano e resgate nao vao juntos. */
  toggleSubscriptionBenefit(): void {
    const coverage = this.subscriptionCoverage();

    if (!coverage?.isCovered) {
      this.useSubscriptionBenefit.set(false);
      return;
    }

    this.useSubscriptionBenefit.update((currentValue) => !currentValue);
    if (this.useSubscriptionBenefit()) {
      this.selectedRedemption.set(null);
    }
  }

  /** "Usar resgate": marca (ou desmarca) o resgate de servico gratis; tira o plano, que nao vai junto. */
  toggleRedemption(): void {
    if (this.selectedRedemption()) {
      this.selectedRedemption.set(null);
      return;
    }

    const redemption = this.usableRedemptions()[0] ?? null;
    this.selectedRedemption.set(redemption);
    if (redemption) {
      this.useSubscriptionBenefit.set(false);
    }
  }

  /** Plano ou resgate: o horario sai sem custo. */
  isFreeOfCharge(): boolean {
    return isFreeOfCharge(this.useSubscriptionBenefit(), this.selectedRedemption());
  }

  /** Alterna o painel de resumo no mobile. */
  toggleMobileSummary(): void {
    this.isMobileSummaryOpen.update((isOpen) => !isOpen);
  }

  /** Exibe erro de campo apenas quando o usuario ja interagiu com ele. */
  shouldShowFieldError(fieldName: keyof BookingCustomer): boolean {
    const formControl = this.customerForm.controls[fieldName];
    return formControl.invalid && formControl.touched;
  }

  /** Confirma o agendamento real na API e exibe sucesso apenas apos HTTP 201. */
  confirmBooking(): void {
    const service = this.selectedService();
    const selectedDate = this.selectedDate();
    const selectedAvailabilitySlot = this.selectedAvailabilitySlot();

    if (this.isSubmitting()) {
      return;
    }

    if (!service || !selectedDate || !selectedAvailabilitySlot || !this.canConfirmBooking()) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.appointmentErrorMessage.set('');

    this.publicBookingApiService.createAppointment(this.companyContextService.companySlug(), this.createAppointmentRequest(service, selectedDate, selectedAvailabilitySlot)).pipe(
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (appointmentConfirmation) => {
        this.refreshMembershipAfterAction();
        this.savedBooking.set(this.mapAppointmentConfirmationToBooking(appointmentConfirmation));
        this.confirmationDialogOpen.set(true);
        this.bookingStorageService.clearBookingDraft();
        this.isMobileSummaryOpen.set(false);
        this.requestAvailabilityWhenReady();
        this.toastService.showSuccess('Agendamento confirmado', 'Seu horário foi reservado com sucesso.', appointmentConfirmation.confirmationCode);
      },
      error: (error: unknown) => this.handleCreateAppointmentError(error)
    });
  }

  /** Monta a URL do Google Calendar usando os dados confirmados pela API. */
  getCalendarUrl(): string {
    return getCalendarUrl(this.companyContextService.name(), this.savedBooking());
  }

  /**
   * WhatsApp da barbearia da URL com a mensagem do agendamento confirmado. Sem numero cadastrado devolve null e a
   * tela esconde o botao: nunca um numero do build ou de outra empresa.
   */
  getWhatsappUrl(): string | null {
    return getWhatsappUrl(this.companyContextService.publicCompany(), this.savedBooking());
  }

  /** Formata data confirmada pela API para exibicao na tela de sucesso. */
  getConfirmedBookingDateLabel(booking: Booking): string {
    return getConfirmedBookingDateLabel(booking);
  }

  /** Formata valor confirmado pela API para exibicao na tela de sucesso. */
  getConfirmedBookingPriceLabel(booking: Booking): string {
    return getConfirmedBookingPriceLabel(booking);
  }

  /** Cria a lista visual de dias; indisponibilidade real vem dos slots da API. */
  private createCalendarDays(visibleMonth: Date): readonly CalendarDay[] {
    return createCalendarDays(visibleMonth);
  }

  /** Cria o resumo derivado das selecoes sem duplicar regra no template. */
  private createBookingSummary(): BookingSummaryViewModel {
    return createBookingSummary({
      selectedService: this.selectedService(),
      professionalName: this.createEffectiveProfessionalName(),
      selectedDate: this.selectedDate(),
      selectedAvailabilitySlot: this.selectedAvailabilitySlot(),
      paymentSimulation: this.paymentSimulation(),
      selectedRedemption: this.selectedRedemption(),
      useSubscriptionBenefit: this.useSubscriptionBenefit(),
      subscriptionCoverage: this.subscriptionCoverage(),
      isFreeOfCharge: this.isFreeOfCharge()
    });
  }

  /** Normaliza uma data para inicio do mes. */
  private createMonthStartDate(date: Date): Date {
    return createMonthStartDate(date);
  }

  /** Formata data como valor ISO simples usado nos botoes do calendario. */
  private formatDateValue(date: Date): string {
    return formatDateValue(date);
  }

  /** Formata data selecionada para leitura humana no resumo. */
  private formatDisplayDate(dateValue: string): string {
    return formatDisplayDate(dateValue);
  }

  /** Formata valores monetarios do resumo de agendamento. */
  private formatPrice(price: number): string {
    return formatPrice(price);
  }

  /** Carrega os servicos reais da API publica e preserva mensagens simples de erro. */
  private loadServices(): void {
    this.isLoadingServices.set(true);
    this.servicesErrorMessage.set('');

    this.publicBookingApiService.getServices(this.companyContextService.companySlug()).pipe(
      takeUntil(this.companyChanges),
      catchError(() => {
        this.servicesErrorMessage.set('Não foi possível carregar os serviços. Tente novamente em instantes.');
        return of<PublicService[]>([]);
      }),
      finalize(() => this.isLoadingServices.set(false))
    ).subscribe((publicServices) => {
      const services = publicServices.map((publicService) => this.mapPublicServiceToBarberService(publicService));
      this.allServices = services;
      this.applyRouteProfessionalServiceFilter();
      this.applyPendingInitialServiceSelection();
    });
  }

  /** Recarrega os servicos (preco novo, D7) mantendo servico, profissional, dia e horario escolhidos. */
  private refreshServicePrices(): void {
    const selectedId = this.selectedService()?.id;
    this.publicBookingApiService.getServices(this.companyContextService.companySlug()).pipe(
      takeUntil(this.companyChanges),
      catchError(() => of<PublicService[]>([]))
    ).subscribe((publicServices) => {
      if (!publicServices.length) {
        return;
      }

      this.allServices = publicServices.map((publicService) => this.mapPublicServiceToBarberService(publicService));
      this.applyRouteProfessionalServiceFilter();
      const updated = this.allServices.find((service) => service.id === selectedId);
      if (updated) {
        this.selectedService.set(updated);
      }
    });
  }

  /** Registra a busca reativa dos profissionais sempre que o servico selecionado muda. */
  private registerServiceSelectionListener(): void {
    this.selectedServiceRequests.pipe(
      switchMap((service) => {
        this.isLoadingProfessionals.set(true);
        this.professionalsErrorMessage.set('');

        const companySlug = this.companyContextService.companySlug();
        // Quem atende pelo plano vem junto; falha ou sessao anonima = sem plano, e a lista segue como antes.
        const covering$ = this.isMemberCustomer()
          ? this.publicBookingApiService.getSubscriptionCoveringProfessionals(companySlug, service.id).pipe(catchError(() => of(null)))
          : of(null);

        return forkJoin({
          publicProfessionals: this.publicBookingApiService.getProfessionalsByService(companySlug, service.id).pipe(
            catchError(() => {
              this.professionalsErrorMessage.set('Não foi possível carregar os profissionais deste serviço.');
              return of<PublicServiceProfessional[]>([]);
            })
          ),
          covering: covering$
        }).pipe(takeUntil(this.companyChanges), finalize(() => this.isLoadingProfessionals.set(false)));
      })
    ).subscribe(({ publicProfessionals, covering }) => {
      this.applyPlanCoverage(covering);
      const professionals = this.sortPlanProfessionalsFirst(publicProfessionals.map((publicProfessional) => this.mapPublicProfessionalToProfessional(publicProfessional)));
      this.professionals.set(professionals);
      this.applyOrValidateProfessionalSelection(professionals);
    });
  }

  readonly joinNames = joinNames;

  /**
   * Cliente com plano cujo horario escolhido nao e coberto: o motivo e o valor que sera cobrado, mostrados antes de
   * confirmar. Null quando coberto, sem plano para o servico ou ainda sem consulta.
   */
  readonly uncoveredWarning = computed(() => {
    return getUncoveredWarning(this.subscriptionCoverage(), this.selectedService()?.price ?? null);
  });

  /** O profissional atende pelo plano do cliente (selo "Pelo seu plano" na lista). */
  isCoveredByPlan(professionalId: string): boolean {
    return isCoveredByPlan(professionalId, this.planProfessionalIds());
  }

  private applyPlanCoverage(covering: PublicSubscriptionCoveringProfessionals | null): void {
    const state = resolvePlanCoverageState(covering);
    this.planName.set(state.planName);
    this.planProfessionalIds.set(state.planProfessionalIds);
  }

  /** Profissionais que atendem pelo plano primeiro, mantendo a ordem da API entre eles. */
  private sortPlanProfessionalsFirst(professionals: Professional[]): Professional[] {
    return sortPlanProfessionalsFirst(professionals, this.planProfessionalIds());
  }

  /** Registra a busca reativa dos horarios sempre que servico, data ou profissional mudam. */
  private registerAvailabilitySelectionListener(): void {
    this.availabilityRequests.pipe(
      switchMap(() => {
        const service = this.selectedService();
        const selectedDate = this.selectedDate();

        if (!service || !selectedDate) {
          return of<PublicAvailability | null>(null);
        }

        this.isLoadingAvailability.set(true);
        this.availabilityErrorMessage.set('');
        this.timeOptions.set([]);
        this.clearSubscriptionBenefitSelection();

        const professionalId = this.allowsAnyProfessional() ? undefined : this.selectedProfessional()?.id;

        return this.publicBookingApiService.getAvailability(this.companyContextService.companySlug(), service.id, selectedDate, professionalId).pipe(
          takeUntil(this.companyChanges),
          catchError(() => {
            this.availabilityErrorMessage.set('Não foi possível carregar os horários disponíveis.');
            this.timeOptions.set([]);
            return of<PublicAvailability | null>(null);
          }),
          finalize(() => this.isLoadingAvailability.set(false))
        );
      })
    ).subscribe((availability) => {
      if (!availability) {
        return;
      }

      this.timeOptions.set(this.createTimeOptions(availability.slots));
      this.loadSubscriptionCoverage();
    });
  }

  /** Monta o payload da fila com o cliente do formulario publico atual. */
  private createWaitlistRequest(serviceId: string, professionalId: string, selectedDate: string): CreateAppointmentWaitlistRequest {
    return createWaitlistRequest(
      serviceId,
      professionalId,
      selectedDate,
      this.selectedWaitlistPeriod(),
      this.customerForm.getRawValue(),
      this.isAuthenticatedCustomer()
    );
  }

  /** Carrega todos os profissionais somente para resolver uma pre-selecao sem servico. */
  private loadProfessionalsForInitialSelection(): void {
    this.isLoadingProfessionals.set(true);
    this.professionalsErrorMessage.set('');

    this.publicBookingApiService.getProfessionals(this.companyContextService.companySlug()).pipe(
      takeUntil(this.companyChanges),
      catchError(() => {
        this.professionalsErrorMessage.set('Não foi possível carregar o profissional selecionado.');
        return of<PublicProfessional[]>([]);
      }),
      finalize(() => this.isLoadingProfessionals.set(false))
    ).subscribe((publicProfessionals) => {
      const professionals = publicProfessionals.map((publicProfessional) => this.mapPublicProfessionalToProfessional(publicProfessional));
      this.professionals.set(professionals);
      this.applyPendingProfessionalSelection(publicProfessionals);
    });
  }

  /** Aplica a selecao inicial de servico quando os dados vindos da API ja estao carregados. */
  private applyPendingInitialServiceSelection(): void {
    if (!this.pendingInitialServiceId) {
      return;
    }

    const service = this.services().find((availableService) => availableService.id === this.pendingInitialServiceId);

    if (!service) {
      return;
    }

    this.pendingInitialServiceId = null;
    this.selectService(service);
  }

  /** Aplica a selecao inicial de profissional depois da busca por servico retornar. */
  private applyPendingProfessionalSelection(publicProfessionals: readonly PublicProfessional[]): void {
    if (!this.pendingInitialProfessionalId) {
      return;
    }

    const publicProfessional = publicProfessionals.find((availableProfessional) => availableProfessional.id === this.pendingInitialProfessionalId);

    if (!publicProfessional) {
      this.pendingInitialProfessionalId = null;
      this.routeProfessionalServiceIds = null;
      this.selectedProfessional.set(null);
      this.applyRouteProfessionalServiceFilter();
      this.saveDraftSelection();
      return;
    }

    this.pendingInitialProfessionalId = null;
    this.routeProfessionalServiceIds = publicProfessional.serviceIds;
    this.allowsAnyProfessional.set(false);
    this.selectedProfessional.set(this.mapPublicProfessionalToProfessional(publicProfessional));
    this.clearSelectedTime();
    this.applyRouteProfessionalServiceFilter();
    this.saveDraftSelection();
    this.requestAvailabilityWhenReady();
  }

  /** Mantem o profissional se ele atende ao servico carregado; caso contrario limpa a selecao. */
  private applyOrValidateProfessionalSelection(professionals: readonly Professional[]): void {
    if (this.pendingInitialProfessionalId) {
      const professional = professionals.find((availableProfessional) => availableProfessional.id === this.pendingInitialProfessionalId);

      if (professional) {
        this.pendingInitialProfessionalId = null;
        this.selectProfessional(professional);
        return;
      }

      this.pendingInitialServiceId = null;
      this.selectedService.set(null);
      this.professionals.set([]);
      this.clearSelectedDateAndTime();
      this.saveDraftSelection();
      return;
    }

    const selectedProfessional = this.selectedProfessional();

    if (!selectedProfessional) {
      this.saveDraftSelection();
      return;
    }

    const matchingProfessional = professionals.find((professional) => professional.id === selectedProfessional.id);

    if (matchingProfessional) {
      this.selectedProfessional.set(matchingProfessional);
      this.saveDraftSelection();
      return;
    }

    this.selectedProfessional.set(null);
    this.clearSelectedTime();
    this.saveDraftSelection();
  }

  /** Filtra servicos pela prioridade do profissional da URL e remove selecao incompatível. */
  private applyRouteProfessionalServiceFilter(): void {
    const routeProfessionalServiceIds = this.routeProfessionalServiceIds;

    if (!routeProfessionalServiceIds) {
      this.services.set(this.allServices);
      return;
    }

    const allowedServiceIds = new Set(routeProfessionalServiceIds);
    this.services.set(this.allServices.filter((service) => allowedServiceIds.has(service.id)));

    const selectedService = this.selectedService();

    if (selectedService && !allowedServiceIds.has(selectedService.id)) {
      this.pendingInitialServiceId = null;
      this.selectedService.set(null);
      this.clearSelectedDateAndTime();
    }
  }

  /** Remove o filtro criado pela URL quando o usuario escolhe outro modo de profissional. */
  private clearRouteProfessionalServiceFilter(): void {
    if (!this.routeProfessionalServiceIds) {
      return;
    }

    this.routeProfessionalServiceIds = null;
    this.applyRouteProfessionalServiceFilter();
  }

  /** Restaura selecoes simples do localStorage usando o mesmo storage existente do projeto. */
  private restoreDraftSelection(): void {
    const bookingDraft = this.bookingStorageService.getBookingDraft();

    if (!bookingDraft) {
      return;
    }

    // Rascunho de outra empresa (ou antigo, sem empresa) nao volta: profissional e horario sao de la (B-1).
    if (bookingDraft.companySlug !== this.companyContextService.companySlug()) {
      this.bookingStorageService.clearBookingDraft();
      return;
    }

    this.pendingInitialServiceId = bookingDraft.selectedServiceId;
    this.selectedProfessional.set(bookingDraft.selectedProfessional);
    this.allowsAnyProfessional.set(bookingDraft.allowsAnyProfessional);
    this.selectedAvailabilitySlot.set(bookingDraft.selectedAvailabilitySlot ?? null);
    this.selectedTime.set(bookingDraft.selectedAvailabilitySlot?.startTime ?? null);
  }

  /** Persiste apenas selecoes serializaveis, sem Signals ou Observables. */
  private saveDraftSelection(): void {
    this.bookingStorageService.saveBookingDraft({
      companySlug: this.companyContextService.companySlug(),
      selectedServiceId: this.selectedService()?.id ?? null,
      selectedProfessional: this.selectedProfessional(),
      allowsAnyProfessional: this.allowsAnyProfessional(),
      selectedAvailabilitySlot: this.selectedAvailabilitySlot()
    });
  }

  /** Solicita disponibilidade apenas quando servico e data ja existem. */
  private requestAvailabilityWhenReady(): void {
    if (!this.selectedService() || !this.selectedDate()) {
      this.timeOptions.set([]);
      this.clearSubscriptionBenefitSelection();
      return;
    }

    this.availabilityRequests.next();
  }

  /** Busca saldo de assinatura para o slot selecionado quando o cliente esta autenticado. */
  private loadSubscriptionCoverage(): void {
    const service = this.selectedService();
    const slot = this.selectedAvailabilitySlot();
    const selectedProfessional = this.selectedProfessional();
    const selectedDate = this.selectedDate();

    this.clearSubscriptionBenefitSelection();

    const professionalId = slot?.professionalId ?? selectedProfessional?.id;

    if (!this.isMemberCustomer() || !service || !professionalId || !selectedDate) {
      return;
    }

    this.publicBookingApiService.getUsableRedemptions(this.companyContextService.companySlug(), service.id, this.replacingAppointmentId()).pipe(
      takeUntil(this.companyChanges)
    ).subscribe({
      next: (redemptions) => this.usableRedemptions.set(redemptions),
      error: () => this.usableRedemptions.set([])
    });

    this.isLoadingSubscriptionCoverage.set(true);
    this.publicBookingApiService.getSubscriptionCoverage(this.companyContextService.companySlug(), service.id, professionalId, selectedDate, this.replacingAppointmentId()).pipe(
      takeUntil(this.companyChanges),
      finalize(() => this.isLoadingSubscriptionCoverage.set(false))
    ).subscribe({
      next: (coverage) => {
        this.subscriptionCoverage.set(coverage);
        // Horario coberto ja sai pelo plano, como no painel (M11); "Usar pagamento comum" desfaz. Resgate escolhido fica.
        if (coverage?.isCovered && !this.selectedRedemption()) {
          this.useSubscriptionBenefit.set(true);
        }
      },
      error: () => this.subscriptionCoverage.set(null)
    });
  }

  /** Cria o payload do POST usando o profissional exato retornado no slot de disponibilidade. */
  private createAppointmentRequest(service: BarberService, selectedDate: string, selectedAvailabilitySlot: BookingAvailabilitySlot): CreatePublicAppointmentRequest {
    return createAppointmentRequest({
      service,
      selectedDate,
      selectedAvailabilitySlot,
      customer: this.customerForm.getRawValue(),
      isAuthenticatedCustomer: this.isAuthenticatedCustomer(),
      useSubscriptionBenefit: this.useSubscriptionBenefit(),
      selectedRedemptionId: this.selectedRedemption()?.id,
      isMemberCustomer: this.isMemberCustomer(),
      replacingAppointmentId: this.replacingAppointmentId()
    });
  }

  /** Converte a confirmacao da API no modelo visual da tela de sucesso. */
  private mapAppointmentConfirmationToBooking(appointmentConfirmation: PublicAppointmentConfirmation): Booking {
    const rawForm = this.customerForm.getRawValue();
    return mapAppointmentConfirmationToBooking(
      appointmentConfirmation,
      this.createConfirmedService(appointmentConfirmation),
      this.createConfirmedProfessional(appointmentConfirmation),
      rawForm.notes,
      rawForm.acceptedCancellationPolicy
    );
  }

  /** Atualiza validators para campos pessoais ficarem obrigatorios somente no fluxo anonimo. */
  private registerAuthenticatedCustomerFormRules(): void {
    effect(() => {
      this.updateCustomerIdentityControls(this.isAuthenticatedCustomer());
    });
  }

  /**
   * Reseta o agendamento em andamento sempre que a identidade autenticada muda (login, logout ou troca de conta). A
   * identidade e a conta: o vinculo que aparece logo depois de agendar (item 7) e a mesma pessoa e nao apaga a confirmacao.
   */
  private registerCustomerIdentityResetRule(): void {
    effect(() => {
      const currentUser = this.customerSessions.currentCustomer();
      const accountId = this.customerSessions.account()?.id;
      const identityKey = accountId ? `account:${accountId}` : currentUser ? `${currentUser.role}:${currentUser.id}` : 'anonymous';

      if (this.lastKnownAuthIdentity === undefined) {
        this.lastKnownAuthIdentity = identityKey;
        return;
      }

      if (this.lastKnownAuthIdentity !== identityKey) {
        this.lastKnownAuthIdentity = identityKey;
        this.resetBooking();
      }
    });
  }

  /** Remove validacao de identidade editavel quando o cliente ja vem do backend autenticado. */
  private updateCustomerIdentityControls(isAuthenticatedCustomer: boolean): void {
    const fullNameControl = this.customerForm.controls.fullName;
    const phoneControl = this.customerForm.controls.phone;
    const emailControl = this.customerForm.controls.email;

    if (isAuthenticatedCustomer) {
      fullNameControl.clearValidators();
      phoneControl.clearValidators();
      emailControl.setValidators([Validators.email]);
      fullNameControl.setValue('', { emitEvent: false });
      phoneControl.setValue('', { emitEvent: false });
      emailControl.setValue('', { emitEvent: false });
    } else {
      fullNameControl.setValidators([Validators.required, Validators.minLength(3)]);
      phoneControl.setValidators([Validators.required, Validators.minLength(10)]);
      emailControl.setValidators([Validators.email]);
    }

    fullNameControl.updateValueAndValidity({ emitEvent: true });
    phoneControl.updateValueAndValidity({ emitEvent: true });
    emailControl.updateValueAndValidity({ emitEvent: true });
  }

  /** Cria o servico confirmado usando preco e duracao retornados pela API. */
  private createConfirmedService(appointmentConfirmation: PublicAppointmentConfirmation): BarberService {
    return createConfirmedService(appointmentConfirmation, this.services());
  }

  /** Cria o profissional confirmado reaproveitando foto/dados locais quando ja estao carregados. */
  private createConfirmedProfessional(appointmentConfirmation: PublicAppointmentConfirmation): Professional {
    return createConfirmedProfessional(appointmentConfirmation, this.professionals());
  }

  /** Fecha a janela de confirmacao; o resumo do agendamento continua na tela. */
  closeConfirmation(): void {
    this.confirmationDialogOpen.set(false);
  }

  /** Confere o vinculo com esta empresa ao abrir o agendamento (o cliente desta empresa preenche o formulario). */
  checkMembership(): void {
    this.customerSessions.ensureSession(this.companyContextService.companySlug()).subscribe();
  }

  /** Reenvia o link de confirmacao do e-mail da conta (pedido na regra 3 do item 7). */
  resendEmailConfirmation(): void {
    this.emailConfirmationFeedback.set('');
    this.customerSessions.resendVerification().subscribe({
      next: () => this.emailConfirmationFeedback.set(`Enviamos um novo link para ${this.customerSessions.account()?.email ?? 'o seu e-mail'}. Depois de confirmar, é só agendar.`),
      error: () => this.emailConfirmationFeedback.set('Não foi possível reenviar agora. Tente novamente em instantes.')
    });
  }

  /** Conta logada ainda sem vinculo nesta empresa: e quando o servidor cria ou liga o vinculo ao agendar (item 7). */
  private isAccountWithoutMembership(): boolean {
    return this.customerSessions.isAccountAuthenticated() && !this.customerSessions.currentCustomer();
  }

  /**
   * Conflito para a conta sem vinculo pode ser o caso B do item 7 ("Fale com a empresa"): mostra o texto do servidor,
   * que e generico. Nos demais casos fica a mensagem da tela.
   */
  private conflictMessage(error: HttpErrorResponse, fallback: string): string {
    return conflictMessage(error, fallback, this.isAccountWithoutMembership());
  }

  /** Depois de agendar ou entrar na fila logado: o servidor pode ter criado ou ligado o vinculo (item 7). */
  private refreshMembershipAfterAction(): void {
    if (this.isAccountWithoutMembership()) {
      const companySlug = this.companyContextService.companySlug();
      this.customerSessions.forgetMembership(companySlug);
      this.customerSessions.ensureSession(companySlug).subscribe();
    }
  }

  /** 403 com o codigo da regra 3: a tela mostra a mensagem e o "Reenviar link". */
  private isEmailConfirmationRequired(error: unknown): error is HttpErrorResponse {
    return isEmailConfirmationRequired(error);
  }

  /** Trata falhas de criacao sem exibir sucesso falso ao usuario. */
  private handleCreateAppointmentError(error: unknown): void {
    const parsed = parseAppointmentError(error);

    if (parsed.type === 'email-confirmation') {
      this.emailConfirmationMessage.set(parsed.message);
      return;
    }

    if (parsed.type === 'slot-unavailable') {
      this.appointmentErrorMessage.set(parsed.message);
      this.clearSelectedTime();
      this.requestAvailabilityWhenReady();
      return;
    }

    if (parsed.type === 'price-changed') {
      this.appointmentErrorMessage.set(parsed.message);
      this.refreshServicePrices();
      return;
    }

    this.appointmentErrorMessage.set(parsed.message);
  }

  /** Trata falhas de criacao da fila com mensagens de usuario. */
  private handleCreateWaitlistError(error: unknown): void {
    const parsed = parseWaitlistError(error, this.isAccountWithoutMembership());

    if (parsed.type === 'email-confirmation') {
      this.emailConfirmationMessage.set(parsed.message);
      return;
    }

    this.waitlistErrorMessage.set(parsed.message);

    if (parsed.type === 'conflict') {
      this.requestAvailabilityWhenReady();
    }
  }

  /** Retorna a data atual da empresa em yyyy-MM-dd usando o timezone configurado. */
  private getCurrentCompanyDateValue(): string {
    return getCurrentCompanyDateValue();
  }

  /** Cria Date local a partir de yyyy-MM-dd sem conversao UTC implicita. */
  private createDateFromDateValue(dateValue: string): Date {
    return createDateFromDateValue(dateValue);
  }

  /** Formata data/hora para URL do Google Calendar no timezone configurado. */
  private createCalendarDateTimeValue(dateValue: string, timeValue: string): string {
    return createCalendarDateTimeValue(dateValue, timeValue);
  }

  /** Limpa data e horario quando o servico muda. */
  private clearSelectedDateAndTime(): void {
    this.selectedDate.set(null);
    this.clearSelectedTime();
  }

  /** Limpa horario e slots antigos para evitar selecao incompativel. */
  private clearSelectedTime(): void {
    this.selectedTime.set(null);
    this.selectedAvailabilitySlot.set(null);
    this.timeOptions.set([]);
    this.clearSubscriptionBenefitSelection();
  }

  /** Limpa cobertura e escolha de beneficio de assinatura. */
  private clearSubscriptionBenefitSelection(): void {
    this.subscriptionCoverage.set(null);
    this.useSubscriptionBenefit.set(false);
    this.usableRedemptions.set([]);
    this.selectedRedemption.set(null);
  }

  /** Retorna o nome efetivo do profissional, incluindo slots de qualquer profissional. */
  private createEffectiveProfessionalName(): string {
    return createEffectiveProfessionalName(
      this.selectedProfessional(),
      this.selectedAvailabilitySlot(),
      this.allowsAnyProfessional()
    );
  }

  /** Cria um profissional efetivo quando o slot veio da opcao qualquer profissional. */
  private createEffectiveProfessional(): Professional | null {
    return createEffectiveProfessional(
      this.selectedProfessional(),
      this.selectedAvailabilitySlot()
    );
  }

  /** Converte o DTO de servico publico para o modelo visual usado no agendamento. */
  private mapPublicServiceToBarberService(publicService: PublicService): BarberService {
    return mapPublicServiceToBarberService(publicService);
  }

  /** Converte o DTO de profissional publico para o modelo visual usado no agendamento. */
  private mapPublicProfessionalToProfessional(publicProfessional: PublicProfessional | PublicServiceProfessional): Professional {
    return mapPublicProfessionalToProfessional(publicProfessional);
  }

  /** Converte uma opcao visual para o slot persistido no rascunho. */
  private mapTimeOptionToBookingAvailabilitySlot(timeOption: TimeOption): BookingAvailabilitySlot {
    return mapTimeOptionToBookingAvailabilitySlot(timeOption);
  }

  /**
   * Monta a lista de horarios exibida. Com "qualquer profissional" a API devolve um slot por
   * profissional livre, o que repetia cada horario na tela e contradizia a promessa de
   * "primeiro horário livre": aqui cada horario aparece uma vez, ja com o primeiro profissional.
   */
  private createTimeOptions(slots: readonly PublicAvailabilitySlot[]): TimeOption[] {
    return createTimeOptions(slots, this.allowsAnyProfessional(), (professionalId) => this.isCoveredByPlan(professionalId));
  }

  /** Converte o slot publico da API para o botao visual de horario. */
  private mapPublicAvailabilitySlotToTimeOption(publicAvailabilitySlot: PublicAvailabilitySlot): TimeOption {
    return mapPublicAvailabilitySlotToTimeOption(publicAvailabilitySlot);
  }
}
