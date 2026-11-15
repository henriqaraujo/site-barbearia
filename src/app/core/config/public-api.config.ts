import { environment } from '../../../environments/environment';

export const PUBLIC_API_CONFIG = {
  apiBaseUrl: environment.apiBaseUrl,
  timeZoneId: environment.timeZoneId
} as const;