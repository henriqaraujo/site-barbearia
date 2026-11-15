import { Routes } from '@angular/router';
import { MyAccountLayoutComponent } from './layout/my-account-layout.component';

/** /minha-conta (Fases 4 e 6): Inicio, Agendar, Meus agendamentos, Favoritos e Dados da conta. */
export const myAccountRoutes: Routes = [
  {
    path: '',
    component: MyAccountLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Minha conta · HL Gestão',
        loadComponent: () => import('./pages/home/my-account-home.component').then((component) => component.MyAccountHomeComponent)
      },
      {
        path: 'agendar',
        title: 'Agendar · HL Gestão',
        loadComponent: () => import('./pages/schedule/my-account-schedule.component').then((component) => component.MyAccountScheduleComponent)
      },
      {
        path: 'agendamentos',
        title: 'Meus agendamentos · HL Gestão',
        loadComponent: () => import('./pages/appointments/my-account-appointments.component').then((component) => component.MyAccountAppointmentsComponent)
      },
      {
        path: 'favoritos',
        title: 'Favoritos · HL Gestão',
        loadComponent: () => import('./pages/favorites/my-account-favorites.component').then((component) => component.MyAccountFavoritesComponent)
      },
      {
        path: 'dados',
        title: 'Dados da conta · HL Gestão',
        loadComponent: () => import('./pages/settings/my-account-settings.component').then((component) => component.MyAccountSettingsComponent)
      },
      // Fidelidade e Meu plano sairam da conta (ficam na area do cliente de cada empresa): links antigos voltam ao Inicio.
      { path: 'fidelidade', redirectTo: '' },
      { path: 'meu-plano', redirectTo: '' }
    ]
  }
];
