import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PUBLIC_API_CONFIG } from '../config/public-api.config';
import { Product } from '../models/product.model';
import { resolveApiAssetUrl } from '../utils/api-asset-url.util';

@Injectable({ providedIn: 'root' })
export class PublicProductsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = PUBLIC_API_CONFIG.apiBaseUrl;

  /** Busca produtos publicos ativos e em estoque para a empresa informada. */
  getProducts(companySlug: string): Observable<Product[]> {
    return this.httpClient.get<Product[]>(`${this.apiBaseUrl}/api/public/companies/${encodeURIComponent(companySlug)}/products`).pipe(
      map((products) => products.map((product) => ({
        ...product,
        imageUrl: resolveApiAssetUrl(product.imageUrl)
      })))
    );
  }
}
