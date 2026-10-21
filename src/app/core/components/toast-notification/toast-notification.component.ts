import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroXCircle,
  heroExclamationTriangle,
  heroInformationCircle,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-notification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      heroCheckCircle,
      heroXCircle,
      heroExclamationTriangle,
      heroInformationCircle,
      heroXMark,
    }),
  ],
  templateUrl: './toast-notification.component.html',
})
export class ToastNotificationComponent {
  protected readonly toastService = inject(ToastService);

  /**
   * Resuelve el nombre del icono Heroicon correspondiente al tipo de notificación toast.
   * @param type Tipo de notificación ('success', 'error', 'warning', 'info').
   * @returns Nombre del icono representativo.
   */
  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'heroCheckCircle';
      case 'error':   return 'heroXCircle';
      case 'warning': return 'heroExclamationTriangle';
      default:        return 'heroInformationCircle';
    }
  }

  /**
   * Obtiene las clases CSS de Tailwind según el tipo de notificación para colorear fondo, borde y texto.
   * @param type Tipo de notificación toast.
   * @returns Cadena con clases utilitarias de Tailwind.
   */
  getTypeClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
    }
  }
}
