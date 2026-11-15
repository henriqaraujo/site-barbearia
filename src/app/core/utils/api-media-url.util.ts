import { PUBLIC_API_CONFIG } from '../config/public-api.config';

const ABSOLUTE_URL_PATTERN = /^(https?:)?\/\//i;
const BROWSER_LOCAL_URL_PATTERN = /^(blob:|data:)/i;

/** Resolve URLs de media servidas pela API sem hardcode de host nos componentes. */
export function resolveApiMediaUrl(mediaUrl: string | null | undefined): string {
  if (!mediaUrl) {
    return '';
  }

  if (ABSOLUTE_URL_PATTERN.test(mediaUrl) || BROWSER_LOCAL_URL_PATTERN.test(mediaUrl)) {
    return mediaUrl;
  }

  if (mediaUrl.startsWith('/assets/')) {
    return mediaUrl;
  }

  if (mediaUrl.startsWith('/uploads/')) {
    return `${PUBLIC_API_CONFIG.apiBaseUrl.replace(/\/$/, '')}${mediaUrl}`;
  }

  return mediaUrl;
}
