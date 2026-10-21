import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  output,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PluginOutletDirective, PluginOutputEvent } from './plugin-outlet.directive';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<button (click)="selected.emit(label())">{{ label() }}</button>',
})
class TestRenderer implements OnDestroy {
  readonly label = input.required<string>();
  readonly selected = output<string>();
  destroyed = false;
  ngOnDestroy(): void {
    this.destroyed = true;
  }
}
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PluginOutletDirective],
  template:
    '<ng-container [appPluginOutlet]="renderer()" [pluginInputs]="{ label: label() }" (pluginEvent)="events.push($event)" />',
})
class Host {
  readonly renderer = signal<typeof TestRenderer | undefined>(TestRenderer);
  readonly label = signal('first');
  readonly events: PluginOutputEvent[] = [];
}

describe('PluginOutletDirective', () => {
  it('updates signal inputs without recreating the component and forwards typed output names', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const renderer = fixture.debugElement.query(By.directive(TestRenderer))
      .componentInstance as TestRenderer;
    expect(fixture.nativeElement.textContent).toContain('first');
    fixture.componentInstance.label.set('second');
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(TestRenderer)).componentInstance).toBe(renderer);
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.events).toEqual([{ name: 'selected', value: 'second' }]);
    fixture.componentInstance.renderer.set(undefined);
    await fixture.whenStable();
    expect(renderer.destroyed).toBe(true);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.componentInstance.events).toHaveLength(1);
  });
});
