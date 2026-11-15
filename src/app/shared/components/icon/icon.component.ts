import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'award'
  | 'alert-circle'
  | 'ban'
  | 'arrow-left-right'
  | 'bar-chart'
  | 'bell'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'coins'
  | 'credit-card'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'heart'
  | 'key'
  | 'layout-dashboard'
  | 'list-checks'
  | 'lock'
  | 'log-out'
  | 'mail'
  | 'map-pin'
  | 'menu'
  | 'message-circle'
  | 'more-vertical'
  | 'package'
  | 'panel-left'
  | 'phone'
  | 'plus'
  | 'power'
  | 'receipt'
  | 'repeat'
  | 'search'
  | 'scissors'
  | 'settings'
  | 'shield'
  | 'shopping-cart'
  | 'sparkles'
  | 'star'
  | 'trash'
  | 'trending-up'
  | 'truck'
  | 'undo'
  | 'user'
  | 'users'
  | 'wallet'
  | 'x';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.component.html',
  styles: [`
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      width: var(--icon-size);
      height: var(--icon-size);
      stroke: currentColor;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(24);
}
