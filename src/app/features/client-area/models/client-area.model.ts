export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
export type NotificationType = 'appointment-confirmed' | 'appointment-reminder' | 'promotion' | 'loyalty-points' | 'appointment-cancelled';
export type HistorySortOrder = 'recent' | 'oldest';

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  avatarUrl: string;
  preferences: ClientPreferences;
}

export interface ClientPreferences {
  whatsappReminder: boolean;
  emailReminder: boolean;
  promotions: boolean;
  news: boolean;
  reminder24Hours: boolean;
  reminder1Hour: boolean;
}

export interface ClientCredentials {
  client: ClientProfile;
  password: string;
}

export interface ClientProfessional {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  photoUrl: string;
}

export interface ClientService {
  id: string;
  name: string;
  durationInMinutes: number;
  price: number;
}

export interface ClientAppointment {
  id: string;
  clientId: string;
  service: ClientService;
  professional: ClientProfessional;
  date: string;
  time: string;
  durationInMinutes: number;
  price: number;
  status: AppointmentStatus;
  cancellationReason?: string;
  subscriptionPlanName?: string;
}

export interface ClientServiceReview {
  overall: number;
  attendance: number;
  environment: number;
  professional: number;
  comment?: string;
}

export interface ClientHistoryRecord {
  id: string;
  clientId: string;
  date: string;
  service: ClientService;
  professional: ClientProfessional;
  paidAmount: number;
  paymentMethod: string;
  status: AppointmentStatus;
  review?: ClientServiceReview;
}

export interface ClientNotification {
  id: string;
  clientId: string;
  title: string;
  message: string;
  date: string;
  type: NotificationType;
  read: boolean;
}

export interface ClientSummary {
  totalVisits: number;
  totalSpent: number;
  favoriteProfessional: string;
}
