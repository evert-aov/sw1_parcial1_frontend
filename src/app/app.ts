import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PluginOutletDirective } from './core/plugins/plugin-outlet.directive';
import { PluginRegistryService } from './core/plugins/plugin-registry.service';
import { ConfirmModalComponent } from './core/components/confirm-modal/confirm-modal.component';
import { ToastNotificationComponent } from './core/components/toast-notification/toast-notification.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, PluginOutletDirective, ConfirmModalComponent, ToastNotificationComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  readonly plugins = inject(PluginRegistryService);
  protected readonly title = signal('UML/ER Studio');
}
