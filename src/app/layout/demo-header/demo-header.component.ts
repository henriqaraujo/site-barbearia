import { ChangeDetectionStrategy, Component, OnDestroy, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TenantUrlPipe } from '../../core/tenancy/tenant-url.pipe';
import { CompanyContextService } from '../../core/services/company-context.service';

interface NavItem { readonly label: string; readonly id: string }

/** Cabecalho do site de apresentacao: marca no canto, atalhos para as secoes da home, "Entrar" e "Agendar horario". */
@Component({
  selector: 'app-demo-header',
  standalone: true,
  imports: [RouterLink, IconComponent, TenantUrlPipe],
  template: `
    <header class="dh" [class.dh--scrolled]="scrolled()">
      <div class="dh__inner">
        <a class="dh__brand" [routerLink]="'' | tenantUrl" fragment="inicio" aria-label="Navalha Preta, início" (click)="close()">
          <svg viewBox="0 0 120 80" width="104" height="70" aria-hidden="true" focusable="false">
            <polygon points="14,40 34,6 86,6 106,40 86,74 34,74" fill="none" stroke="currentColor" stroke-width="2.2" />
            <polygon points="19,40 36,11 84,11 101,40 84,69 36,69" fill="none" stroke="currentColor" stroke-width="1" opacity=".7" />
            <text x="60" y="26" text-anchor="middle" font-size="7" letter-spacing="2" fill="currentColor" font-family="Manrope, sans-serif" font-weight="700">BARBEARIA</text>
            <text x="60" y="47" text-anchor="middle" font-size="19" fill="currentColor" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-weight="700">Navalha</text>
            <text x="60" y="60" text-anchor="middle" font-size="12" fill="currentColor" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-weight="700">Preta</text>
          </svg>
        </a>

        <nav class="dh__nav" [class.dh__nav--open]="open()" aria-label="Navegação principal">
          @for (item of items; track item.id) {
            <a [routerLink]="'' | tenantUrl" [fragment]="item.id" class="dh__link" [class.is-active]="active() === item.id" (click)="close()">{{ item.label }}</a>
          }
          <div class="dh__actions">
            <a class="dh__enter" [routerLink]="'login' | tenantUrl" (click)="close()"><app-icon name="user" [size]="16" /> Entrar</a>
            <a class="dh__book" [routerLink]="'agendamento' | tenantUrl" (click)="close()"><app-icon name="calendar" [size]="16" /> Agendar horário</a>
          </div>
        </nav>

        <button class="dh__menu" type="button" aria-label="Abrir menu" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          <app-icon [name]="open() ? 'x' : 'menu'" [size]="24" />
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host { display: contents; }
    .dh { position: fixed; inset: 0 0 auto; z-index: var(--z-header); color: #1f1b14; font-family: var(--font-interface); background: rgb(246 243 236 / .88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgb(31 27 20 / .1); transition: box-shadow .3s; }
    .dh--scrolled { box-shadow: 0 10px 30px rgb(31 27 20 / .1); }
    .dh__inner { display: flex; align-items: center; gap: 2rem; width: min(1180px, 100%); min-height: 76px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 3rem); }
    .dh__brand { flex: none; color: #8a6417; line-height: 0; }
    .dh__nav { display: flex; flex: 1; align-items: center; gap: clamp(.9rem, 2vw, 1.8rem); }
    .dh__link { position: relative; padding: .4rem 0; font-size: .9rem; font-weight: 600; color: #4a4439; text-decoration: none; white-space: nowrap; transition: color .2s; }
    .dh__link::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #8a6417; transform: scaleX(0); transform-origin: left; transition: transform .3s; }
    .dh__link:hover, .dh__link.is-active { color: #1f1b14; }
    .dh__link.is-active::after, .dh__link:hover::after { transform: scaleX(1); }
    .dh__actions { display: flex; align-items: center; gap: .6rem; margin-left: auto; }
    .dh__enter, .dh__book { display: inline-flex; align-items: center; gap: .5rem; padding: .6rem 1rem; border-radius: 6px; font-size: .9rem; font-weight: 700; text-decoration: none; white-space: nowrap; transition: background-color .2s, color .2s, transform .2s; }
    .dh__enter { border: 1px solid rgb(31 27 20 / .28); color: #1f1b14; }
    .dh__enter:hover { background: rgb(31 27 20 / .06); }
    .dh__book { background: #24211b; color: #f6f3ec; border-bottom: 2px solid #b8862b; }
    .dh__book:hover { background: #3a352b; transform: translateY(-1px); }
    .dh__menu { display: none; margin-left: auto; background: none; border: 0; color: #1f1b14; cursor: pointer; }
    a:focus-visible, button:focus-visible { outline: 2px solid #8a6417; outline-offset: 3px; }
    @media (max-width: 1000px) {
      .dh__menu { display: block; }
      .dh__nav { display: none; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0; padding: .6rem clamp(1rem, 4vw, 3rem) 1.4rem; background: #f6f3ec; border-bottom: 1px solid rgb(31 27 20 / .12); }
      .dh__nav--open { display: flex; }
      .dh__link { padding: .85rem 0; border-bottom: 1px solid rgb(31 27 20 / .08); }
      .dh__link::after { display: none; }
      .dh__actions { margin: 1rem 0 0; flex-direction: column; align-items: stretch; }
      .dh__enter, .dh__book { justify-content: center; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoHeaderComponent implements OnDestroy {
  readonly items: readonly NavItem[] = [
    { label: 'Início', id: 'inicio' },
    { label: 'A Barbearia', id: 'sobre' },
    { label: 'Serviços', id: 'servicos' },
    { label: 'Profissionais', id: 'profissionais' },
    { label: 'Produtos', id: 'produtos' },
    { label: 'Contato', id: 'contato' }
  ];
  readonly scrolled = signal(false);
  readonly active = signal('inicio');
  readonly open = signal(false);

  private readonly router = inject(Router);
  private readonly company = inject(CompanyContextService);
  private observer?: IntersectionObserver;
  private sentinel?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      this.observe();
      // Ao voltar para a home vindo do agendamento, as secoes reaparecem e precisam ser observadas de novo.
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => setTimeout(() => this.observe(), 300));
    });
  }

  close(): void {
    this.open.set(false);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.sentinel?.disconnect();
  }

  /** Marca no menu a secao que esta na faixa central da tela (sem listener de scroll). */
  private observe(): void {
    this.observer?.disconnect();
    this.sentinel?.disconnect();
    const onHome = this.router.url.split(/[?#]/)[0] === this.company.publicUrl();
    if (!onHome) {
      this.scrolled.set(true);
      this.active.set('');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && this.active.set(entry.target.id)),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    this.items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) this.observer!.observe(element);
    });
    // A sombra do cabecalho acompanha a rolagem: um sentinela no topo avisa quando saiu da tela.
    const top = document.getElementById('inicio');
    if (top) {
      this.sentinel = new IntersectionObserver(([entry]) => this.scrolled.set(!entry.isIntersecting || entry.boundingClientRect.top < -40));
      this.sentinel.observe(top);
    }
  }
}
