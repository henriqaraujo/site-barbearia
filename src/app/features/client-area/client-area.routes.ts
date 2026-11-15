import { Routes } from '@angular/router';
import { ClientAreaLayoutComponent } from './layout/client-area-layout.component';

export const clientAreaRoutes: Routes = [
  {
    path: '',
    component: ClientAreaLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/dashboard/client-dashboard.component').then((component) => component.ClientDashboardComponent)
      },
      {
        path: 'agendamentos',
        loadComponent: () => import('./pages/appointments/client-appointments.component').then((component) => component.ClientAppointmentsComponent)
      },
      {
        path: 'historico',
        loadComponent: () => import('./pages/history/client-history.component').then((component) => component.ClientHistoryComponent)
      },
      {
        path: 'meu-plano',
        loadComponent: () => import('./pages/subscription/client-subscription-page.component').then((component) => component.ClientSubscriptionPageComponent)
      },
      {
        path: 'fidelidade',
        loadComponent: () => import('./pages/loyalty/client-loyalty-page.component').then((component) => component.ClientLoyaltyPageComponent)
      },
      // Notificacoes usa dados falsos (mock em memoria), fora ate existir de verdade; link antigo volta ao Inicio.
      { path: 'notificacoes', redirectTo: '' },
      // Meu perfil (dados falsos) virou os dados da conta na /minha-conta.
      { path: 'perfil', redirectTo: '/minha-conta/dados' }
    ]
  }
];
