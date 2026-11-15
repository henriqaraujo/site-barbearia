import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, EventEmitter, HostListener, Injectable, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CustomDropdownCoordinatorService {
  private activeDropdown: CustomDropdownDirective | null = null;

  /** Registra o dropdown ativo e fecha o dropdown anterior para manter apenas um menu aberto. */
  open(dropdown: CustomDropdownDirective): void {
    if (this.activeDropdown && this.activeDropdown !== dropdown) {
      this.activeDropdown.closeFromCoordinator();
    }

    this.activeDropdown = dropdown;
  }

  /** Remove o dropdown ativo quando ele foi fechado pelo proprio componente. */
  close(dropdown: CustomDropdownDirective): void {
    if (this.activeDropdown === dropdown) {
      this.activeDropdown = null;
    }
  }
}

@Directive({
  selector: '[appCustomDropdown]',
  standalone: true
})
export class CustomDropdownDirective implements OnChanges {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly coordinator = inject(CustomDropdownCoordinatorService);
  private isOpen = false;

  @Input({ alias: 'appCustomDropdown' }) openState: boolean | '' = false;
  @Input() customDropdownReturnFocus = true;
  @Output() customDropdownOpenChange = new EventEmitter<boolean>();

  /** Sincroniza menus controlados por signal externo, como dropdowns que nao usam details. */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['openState'] || this.isDetailsElement()) {
      return;
    }

    this.setOpen(this.openState === true, false);
  }

  /** Sincroniza o estado nativo de details com o coordenador global de dropdowns. */
  @HostListener('toggle')
  onToggle(): void {
    if (!this.isDetailsElement()) {
      return;
    }

    this.setOpen(this.getDetailsElement().open, true);
  }

  /** Fecha o dropdown quando uma acao interna marcada para fechamento foi selecionada. */
  @HostListener('click', ['$event'])
  onHostClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target?.closest('[data-dropdown-close]')) {
      return;
    }

    this.close();
  }

  /** Fecha o dropdown ativo quando o usuario clica fora dele. */
  @HostListener('document:pointerdown', ['$event'])
  closeOnOutsidePointer(event: PointerEvent): void {
    if (!this.isOpen || this.containsEventTarget(event.target)) {
      return;
    }

    this.close();
  }

  /** Fecha o dropdown ativo com Escape e devolve foco ao trigger quando possivel. */
  @HostListener('document:keydown.escape', ['$event'])
  closeOnEscape(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }

    event.preventDefault();
    this.close();
  }

  /** Fecha este dropdown quando outro dropdown coordenado foi aberto. */
  closeFromCoordinator(): void {
    this.close(false);
  }

  /** Fecha o menu atual e emite o novo estado ao componente dono. */
  close(returnFocus = this.customDropdownReturnFocus): void {
    this.setOpen(false, true);

    if (this.isDetailsElement()) {
      this.getDetailsElement().open = false;
    }

    if (returnFocus) {
      this.focusTrigger();
    }
  }

  /** Atualiza estado interno, atributos ARIA e coordenador sem duplicar listeners por componente. */
  private setOpen(isOpen: boolean, emitChange: boolean): void {
    if (this.isOpen === isOpen) {
      return;
    }

    this.isOpen = isOpen;
    this.updateAriaExpanded(isOpen);

    if (isOpen) {
      this.coordinator.open(this);
    } else {
      this.coordinator.close(this);
    }

    if (emitChange) {
      this.customDropdownOpenChange.emit(isOpen);
    }
  }

  /** Verifica se o clique ocorreu dentro do host do dropdown. */
  private containsEventTarget(target: EventTarget | null): boolean {
    return target instanceof Node && this.elementRef.nativeElement.contains(target);
  }

  /** Aplica aria-expanded no trigger do dropdown quando ele existe. */
  private updateAriaExpanded(isOpen: boolean): void {
    const trigger = this.findTriggerElement();
    trigger?.setAttribute('aria-expanded', String(isOpen));
  }

  /** Devolve foco ao botao ou summary que abriu o menu. */
  private focusTrigger(): void {
    this.findTriggerElement()?.focus();
  }

  /** Localiza trigger padronizado do dropdown. */
  private findTriggerElement(): HTMLElement | null {
    if (this.isDetailsElement()) {
      return this.elementRef.nativeElement.querySelector('summary');
    }

    return this.elementRef.nativeElement.querySelector('[data-dropdown-trigger]');
  }

  /** Identifica hosts details para usar o estado nativo open. */
  private isDetailsElement(): boolean {
    return this.elementRef.nativeElement instanceof this.document.defaultView!.HTMLDetailsElement;
  }

  /** Retorna o host tipado como HTMLDetailsElement. */
  private getDetailsElement(): HTMLDetailsElement {
    return this.elementRef.nativeElement as HTMLDetailsElement;
  }
}
