import { PUBLIC_API_CONFIG } from '../config/public-api.config';

/** Resolve URLs de arquivos servidos pela API para uso direto em imagens no navegador. */
export function resolveApiAssetUrl(assetUrl: string | null): string | null {
  if (!assetUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(assetUrl) || assetUrl.startsWith('blob:') || assetUrl.startsWith('data:')) {
    return assetUrl;
  }

  if (assetUrl.startsWith('/uploads/')) {
    return `${PUBLIC_API_CONFIG.apiBaseUrl}${assetUrl}`;
  }

  return assetUrl;
}

/** Converte uma URL absoluta da API de volta para o caminho persistido no banco. */
export function toPersistableApiAssetUrl(assetUrl: string | null): string | null {
  if (!assetUrl) {
    return null;
  }

  if (assetUrl.startsWith(PUBLIC_API_CONFIG.apiBaseUrl)) {
    return assetUrl.slice(PUBLIC_API_CONFIG.apiBaseUrl.length);
  }

  return assetUrl;
}
