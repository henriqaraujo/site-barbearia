import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CustomerAccountProfile, CustomerAccountRefreshResponse } from '../../../core/models/auth.model';
import { CustomerSessionService, customerAccountApiUrl } from '../../../core/services/customer-session.service';
import {
  MyAccountAppointmentPage,
  MyAccountAppointmentScope,
  MyAccountCompany,
  MyAccountDeletionPreview,
  MyAccountMessage
} from '../models/my-account.model';

/**
 * Rotas de /minha-conta (Fase 4). Tudo parte da conta do token: a API nunca recebe id de vinculo; o filtro por empresa
 * vai pelo slug e so encontra empresas da propria conta.
 */
@Injectable({ providedIn: 'root' })
export class MyAccountApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly customerSessions = inject(CustomerSessionService);

  companies(): Observable<MyAccountCompany[]> {
    return this.httpClient.get<MyAccountCompany[]>(`${customerAccountApiUrl()}/companies`);
  }

  appointments(scope: MyAccountAppointmentScope, company: string | null, page = 1): Observable<MyAccountAppointmentPage> {
    let params = new HttpParams().set('scope', scope).set('page', page);
    if (company) {
      params = params.set('company', company);
    }

    return this.httpClient.get<MyAccountAppointmentPage>(`${customerAccountApiUrl()}/appointments`, { params });
  }

  /** Nome e celular so da conta; a sessao guardada passa a mostrar os dados novos. */
  updateProfile(fullName: string, phone: string): Observable<CustomerAccountProfile> {
    return this.httpClient.put<CustomerAccountProfile>(`${customerAccountApiUrl()}/me`, { fullName, phone }).pipe(
      tap((account) => this.customerSessions.applyAccount(account))
    );
  }

  /** Troca de senha: as outras sessoes caem; esta continua com o token novo da resposta. */
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Observable<CustomerAccountRefreshResponse> {
    return this.httpClient.post<CustomerAccountRefreshResponse>(`${customerAccountApiUrl()}/me/password`, { currentPassword, newPassword, confirmPassword }).pipe(
      tap((response) => this.customerSessions.applyRefreshedSession(response))
    );
  }

  requestEmailChange(newEmail: string, currentPassword: string): Observable<MyAccountMessage> {
    return this.httpClient.post<MyAccountMessage>(`${customerAccountApiUrl()}/me/email`, { newEmail, currentPassword });
  }

  confirmEmailChange(token: string): Observable<MyAccountMessage> {
    return this.httpClient.post<MyAccountMessage>(`${customerAccountApiUrl()}/email-change/confirm`, { token });
  }

  revertEmailChange(token: string): Observable<MyAccountMessage> {
    return this.httpClient.post<MyAccountMessage>(`${customerAccountApiUrl()}/email-change/revert`, { token });
  }

  deletionPreview(): Observable<MyAccountDeletionPreview> {
    return this.httpClient.get<MyAccountDeletionPreview>(`${customerAccountApiUrl()}/me/deletion-preview`);
  }

  /** Exclui a conta; a sessao deste navegador e esquecida (o cookie ja foi apagado pela resposta). */
  deleteAccount(confirmEmail: string, currentPassword: string | null): Observable<void> {
    return this.httpClient.delete<void>(`${customerAccountApiUrl()}/me`, {
      body: { confirmEmail, currentPassword },
      withCredentials: true
    }).pipe(tap(() => this.customerSessions.clear()));
  }
}
