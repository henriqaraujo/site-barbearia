import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../../../environments/environment';
import { HeaderComponent } from '../header/header.component';
import { DemoHeaderComponent } from '../demo-header/demo-header.component';
import { FooterComponent } from '../footer/footer.component';
import { FloatingWhatsappButtonComponent } from '../../shared/components/floating-whatsapp-button/floating-whatsapp-button.component';

/** Site da empresa (home, agendamento, contratacao de plano). Os estados da empresa ficam no TenantShellComponent. */
@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, DemoHeaderComponent, FooterComponent, FloatingWhatsappButtonComponent],
  template: `
    <a class="skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a>
    @if (demo) { <app-demo-header /> } @else { <app-header /> }
    <main id="conteudo-principal">
      <router-outlet />
    </main>
    <app-footer />
    <app-floating-whatsapp-button />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicLayoutComponent implements OnDestroy {
  readonly demo = environment.presentationMock;

  constructor() {
    // Modo apresentacao: paleta clara (tokens em styles.scss, bloco .theme-light).
    if (this.demo) {
      document.documentElement.classList.add('theme-light');
    }
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('theme-light');
  }
}
