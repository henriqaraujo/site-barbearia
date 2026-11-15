import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { DEMO_COMPANY_SLUG, DEMO_COMPANY, DEMO_PLANS, DEMO_PRODUCTS, DEMO_PROFESSIONALS, DEMO_SERVICES } from './demo-data';

const PUBLIC_PATH = new RegExp(`/api/public/companies/${DEMO_COMPANY_SLUG}(/[^?]*)?`);

function reply<T>(body: T, status = 200): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status, body })).pipe(delay(120));
}

/** Horarios do dia: de 15 em 15 minutos, com alguns ocupados para o calendario parecer de uma agenda real. */
function buildSlots(date: string, serviceId: string, professionalId: string | null) {
  const service = DEMO_SERVICES.find((item) => item.id === serviceId) ?? DEMO_SERVICES[0];
  const candidates = professionalId ? DEMO_PROFESSIONALS.filter((p) => p.id === professionalId) : DEMO_PROFESSIONALS;
  const seed = Number(date.replaceAll('-', '')) % 97;
  const slots: { startTime: string; endTime: string; professionalId: string; professionalName: string }[] = [];
  for (let minutes = 9 * 60; minutes + service.durationInMinutes <= 19 * 60; minutes += 15) {
    if (minutes >= 12 * 60 && minutes < 13 * 60) continue;
    const pro = candidates[(minutes / 15 + seed) % candidates.length];
    if ((minutes / 15 + seed + pro.name.length) % 3 === 0) continue;
    const end = minutes + service.durationInMinutes;
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    slots.push({ startTime: hhmm(minutes), endTime: hhmm(end), professionalId: pro.id, professionalName: pro.name });
  }
  return slots;
}

/**
 * Backend de demonstracao: so atende a empresa de exemplo e so quando o ambiente liga o modo apresentacao.
 * Todo o resto segue para a rede normalmente.
 */
export const demoBackendInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  if (!environment.presentationMock) {
    return next(request);
  }

  const match = PUBLIC_PATH.exec(request.url);
  if (!match) {
    return next(request);
  }

  const path = match[1] ?? '';

  if (request.method === 'GET') {
    if (path === '') return reply(DEMO_COMPANY);
    if (path === '/services') return reply(DEMO_SERVICES);
    if (path === '/professionals') return reply(DEMO_PROFESSIONALS);
    if (path === '/products') return reply(DEMO_PRODUCTS);
    if (path === '/subscription-plans') return reply(DEMO_PLANS);
    if (/^\/services\/[^/]+\/professionals$/.test(path)) {
      const serviceId = decodeURIComponent(path.split('/')[2]);
      return reply(DEMO_PROFESSIONALS.filter((p) => p.serviceIds.includes(serviceId)));
    }
    if (path === '/availability') {
      const date = request.params.get('date') ?? '';
      const serviceId = request.params.get('serviceId') ?? DEMO_SERVICES[0].id;
      const professionalId = request.params.get('professionalId');
      return reply({ date, serviceId, professionalId, timeZoneId: DEMO_COMPANY.timeZoneId, slots: buildSlots(date, serviceId, professionalId) });
    }
    if (path.includes('/loyalty/') || path.includes('subscription-coverage')) return reply([]);
  }

  if (request.method === 'POST' && path === '/appointments') {
    const body = request.body as { serviceId: string; professionalId: string; date: string; startTime: string; customer?: { name: string; phone: string; email: string | null } | null };
    const service = DEMO_SERVICES.find((item) => item.id === body.serviceId) ?? DEMO_SERVICES[0];
    const professional = DEMO_PROFESSIONALS.find((item) => item.id === body.professionalId) ?? DEMO_PROFESSIONALS[0];
    const [hh, mm] = body.startTime.split(':').map(Number);
    const endMinutes = hh * 60 + mm + service.durationInMinutes;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    return reply({
      appointmentId: crypto.randomUUID(),
      confirmationCode: `NP-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Confirmed',
      service: { id: service.id, name: service.name, durationInMinutes: service.durationInMinutes, price: service.price, depositAmount: 0 },
      professional: { id: professional.id, name: professional.name },
      customer: body.customer ?? { name: 'Cliente', phone: '', email: null },
      date: body.date,
      startTime: body.startTime,
      endTime,
      startDateTime: `${body.date}T${body.startTime}:00`,
      endDateTime: `${body.date}T${endTime}:00`,
      timeZoneId: DEMO_COMPANY.timeZoneId,
      subscriptionCoverage: null
    }, 201);
  }

  return next(request);
};
