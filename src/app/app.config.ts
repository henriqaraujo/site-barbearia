import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { appRoutes } from './app.routes';
import { demoBackendInterceptor } from './demo/demo-backend.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { CompanyRouteReuseStrategy } from './core/tenancy/company-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(withInterceptors([demoBackendInterceptor, authInterceptor])),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    ),
    // Outra empresa na URL recria as telas dela (o seletor de empresa do topo troca assim).
    { provide: RouteReuseStrategy, useClass: CompanyRouteReuseStrategy }
  ]
};
