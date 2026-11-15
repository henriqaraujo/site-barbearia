import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BookingStateService, CalendarDay, TimeOption } from './services/booking-state.service';
import { TenantUrlPipe } from '../../core/tenancy/tenant-url.pipe';
import { ScrollLockService } from '../../core/services/scroll-lock.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { isLegalDocumentVisible, legalDocument } from '../../core/legal/legal-documents';
import { TermPipe } from '../../shared/pipes/term.pipe';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [TermPipe, CurrencyPipe, DatePipe, NgTemplateOutlet, ReactiveFormsModule, RouterLink, IconComponent, TenantUrlPipe],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingComponent {
  readonly bookingState = inject(BookingStateService);
  readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  private readonly router = inject(Router);
  private readonly companyContextService = inject(CompanyContextService);
  /** Nome cadastrado da empresa, na janela de confirmacao (vazio so enquanto carrega). */
  readonly companyName = this.companyContextService.fullName;
  private readonly confirmationClose = viewChild<ElementRef<HTMLButtonElement>>('confirmationClose');
  /** Aviso curto com link para a Politica de Privacidade (some em producao enquanto o texto e rascunho). */
  readonly privacyPolicyPath = isLegalDocumentVisible(legalDocument('privacidade')) ? legalDocument('privacidade').path : null;

  private readonly scrollLock = inject(ScrollLockService);

  constructor() {
    // Com a janela de confirmacao aberta a pagina de tras nao rola.
    effect((onCleanup) => {
      if (this.bookingState.confirmationDialogOpen() && this.bookingState.savedBooking()) {
        onCleanup(this.scrollLock.lock());
      }
    });

    // A janela de confirmacao recebe o foco ao abrir (leitor de tela e teclado: Esc fecha).
    afterRenderEffect(() => this.confirmationClose()?.nativeElement.focus());
    const activatedRoute = inject(ActivatedRoute);
    // O estado e singleton: vindo de outra empresa, limpa tudo dela antes de aplicar a URL (B-1).
    this.bookingState.ensureCompany();
    this.bookingState.checkMembership();
    this.bookingState.applyInitialSelections(
      activatedRoute.snapshot.queryParamMap.get('servico'),
      activatedRoute.snapshot.queryParamMap.get('profissional'),
      activatedRoute.snapshot.queryParamMap.get('data'),
      activatedRoute.snapshot.queryParamMap.get('remarcar')
    );
  }

  /** Seleciona uma data do calendário respeitando os bloqueios visuais. */
  selectDate(calendarDay: CalendarDay): void {
    this.bookingState.selectDate(calendarDay);
  }

  /** Seleciona um horário disponível. */
  selectTime(timeOption: TimeOption): void {
    this.bookingState.selectTime(timeOption);
  }

  /** Retorna para a página inicial após a confirmação. */
  goToHome(): void {
    void this.router.navigateByUrl(this.companyContextService.publicUrl());
  }
}
