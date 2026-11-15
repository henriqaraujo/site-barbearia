import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';

/** Cartao da vitrine (S7): so campos publicos. */
export interface PublicDirectoryCompany {
  slug: string;
  name: string;
  logoUrl: string;
  neighborhood: string | null;
  city: string;
  state: string;
}

export interface PublicDirectoryPage {
  items: PublicDirectoryCompany[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PublicDirectoryCity {
  city: string;
  state: string;
}

/** Cartao de "Perto de você": o da vitrine mais a distancia ate a pessoa. */
export interface PublicNearbyCompany extends PublicDirectoryCompany {
  distanceKm: number;
}

/**
 * Funcoes da vitrine que dependem de back ainda nao feito. "Perto de você" (docs/planos/LEVANTAMENTO-CABECALHO-E-PERTO-DE-VOCE.md)
 * tem o front pronto e fica desligado ate a rota /nearby existir: ligar aqui.
 */
export interface DirectoryFeatures {
  readonly nearby: boolean;
}

export const DIRECTORY_FEATURES = new InjectionToken<DirectoryFeatures>('DIRECTORY_FEATURES', {
  providedIn: 'root',
  factory: () => ({ nearby: false })
});

export interface PublicDirectorySearch {
  q: string | null;
  cidade: string | null;
  uf: string | null;
}

/** Busca da vitrine do HL Gestao (Fase 5): empresas que ligaram "Aparecer na busca". */
@Injectable({ providedIn: 'root' })
export class PublicDirectoryApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly url = `${PUBLIC_API_CONFIG.apiBaseUrl}/api/public/directory`;

  search(search: PublicDirectorySearch, page = 1): Observable<PublicDirectoryPage> {
    let params = new HttpParams().set('page', page);
    for (const [key, value] of Object.entries(search)) {
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.httpClient.get<PublicDirectoryPage>(`${this.url}/search`, { params });
  }

  /**
   * Empresas proximas (plano "Perto de você"; rota ainda nao existe no back). A posicao vai arredondada (3 casas, ~100 m)
   * e nunca e guardada.
   */
  nearby(latitude: number, longitude: number): Observable<PublicNearbyCompany[]> {
    const params = new HttpParams().set('lat', latitude.toFixed(3)).set('lng', longitude.toFixed(3));
    return this.httpClient.get<PublicNearbyCompany[]>(`${this.url}/nearby`, { params });
  }

  cities(term: string | null): Observable<PublicDirectoryCity[]> {
    const params = term ? new HttpParams().set('q', term) : undefined;
    return this.httpClient.get<PublicDirectoryCity[]>(`${this.url}/cities`, { params });
  }
}
