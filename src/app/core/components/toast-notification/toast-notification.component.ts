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

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'heroCheckCircle';
      case 'error':   return 'heroXCircle';
      case 'warning': return 'heroExclamationTriangle';
      default:        return 'heroInformationCircle';
    }
  }

  getTypeClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 dark:bg-[#0C1F17] border-emerald-300 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100 dark:shadow-black/60';
      case 'error':
        return 'bg-red-50 dark:bg-[#260E12] border-red-300 dark:border-red-500 text-red-950 dark:text-red-100 dark:shadow-black/60';
      case 'warning':
        return 'bg-amber-50 dark:bg-[#231A08] border-amber-400 dark:border-amber-400 text-amber-950 dark:text-amber-50 dark:shadow-black/80';
      default:
        return 'bg-blue-50 dark:bg-[#0E1A2E] border-blue-300 dark:border-blue-500 text-blue-950 dark:text-blue-100 dark:shadow-black/60';
    }
  }

  getIconColorClass(type: string): string {
    switch (type) {
      case 'success': return 'text-emerald-600 dark:text-emerald-400';
      case 'error':   return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-amber-600 dark:text-amber-300';
      default:        return 'text-blue-600 dark:text-blue-400';
    }
  }
}
