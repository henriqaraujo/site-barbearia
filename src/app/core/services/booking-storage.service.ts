import { Injectable } from '@angular/core';
import { BookingDraft } from '../models/booking.model';

const BOOKING_DRAFT_STORAGE_KEY = 'hl-gestao-booking-draft';

@Injectable({ providedIn: 'root' })
export class BookingStorageService {

  /** Salva somente seleções serializáveis do rascunho do agendamento. */
  saveBookingDraft(bookingDraft: BookingDraft): void {
    localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(bookingDraft));
  }

  /** Recupera o rascunho de seleção do agendamento sem expor objetos não serializáveis. */
  getBookingDraft(): BookingDraft | null {
    const storedBookingDraft = localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);

    if (!storedBookingDraft) {
      return null;
    }

    try {
      return JSON.parse(storedBookingDraft) as BookingDraft;
    } catch {
      return null;
    }
  }

  /** Remove o rascunho quando a confirmação visual é concluída. */
  clearBookingDraft(): void {
    localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  }
}
