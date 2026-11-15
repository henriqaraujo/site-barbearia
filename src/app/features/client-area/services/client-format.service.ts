import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClientFormatService {
  private readonly currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  /** Formata valores monetarios em reais com Intl.NumberFormat. */
  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  /** Formata data ISO simples no padrao brasileiro. */
  formatDate(dateValue: string): string {
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString('pt-BR');
  }
}
