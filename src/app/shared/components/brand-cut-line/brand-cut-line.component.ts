import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-cut-line',
  standalone: true,
  template: '<span class="brand-cut-line" [class.brand-cut-line--vertical]="vertical()"></span>',
  styles: [`
    .brand-cut-line {
      display: block;
      width: min(11rem, 42vw);
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--brand-accent), var(--brand-secondary));
    }

    .brand-cut-line--vertical {
      width: 2px;
      height: 8rem;
      background: linear-gradient(180deg, transparent, var(--brand-accent), var(--brand-secondary));
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandCutLineComponent {
  readonly vertical = input(false);
}
