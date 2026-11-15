/** Empresa em que a conta tem vinculo ativo (Fase 4). Logo vazio: so o nome. */
export interface MyAccountCompany {
  slug: string;
  name: string;
  logoUrl: string;
}

/** Agendamento de qualquer empresa da conta, com a empresa para o nome, o logo e o atalho "Ver na empresa". */
export interface MyAccountAppointment {
  id: string;
  company: MyAccountCompany;
  serviceName: string;
  professionalName: string;
  date: string;
  time: string;
  durationInMinutes: number;
  price: number;
  status: string;
  cancellationReason: string | null;
}

export interface MyAccountAppointmentPage {
  items: MyAccountAppointment[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type MyAccountAppointmentScope = 'upcoming' | 'history';

export interface MyAccountDeletionPreview {
  upcomingAppointments: number;
  companies: number;
  requiresPassword: boolean;
}

export interface MyAccountMessage {
  message: string;
}
