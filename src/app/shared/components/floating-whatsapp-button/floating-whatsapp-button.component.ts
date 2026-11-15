import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { whatsappDefaultMessage } from '../../../core/constants/business.constants';
import { PublicCompanyStateService } from '../../../core/services/public-company-state.service';
import { companyWhatsappUrl } from '../../../core/utils/company-contact-links';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-floating-whatsapp-button',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './floating-whatsapp-button.component.html',
  styleUrl: './floating-whatsapp-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingWhatsappButtonComponent {
  private readonly publicCompanyStateService = inject(PublicCompanyStateService);
  readonly isVisible = signal(false);
  /** WhatsApp da barbearia; sem numero cadastrado o botao nao aparece. */
  readonly whatsappUrl = signal<string | null>(null);

  constructor() {
    this.loadCompanyWhatsapp();
  }

  /** Mostra o botão flutuante somente depois de uma pequena rolagem. */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isVisible.set(window.scrollY > 420);
  }

  /** Carrega o WhatsApp (ou telefone) publico da empresa para montar o link. */
  private loadCompanyWhatsapp(): void {
    this.publicCompanyStateService.getCompany().pipe(
      catchError(() => of(null))
    ).subscribe((company) => this.whatsappUrl.set(companyWhatsappUrl(company, whatsappDefaultMessage(company?.name))));
  }
}
