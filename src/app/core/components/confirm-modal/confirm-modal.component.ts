import { Component, HostListener, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroExclamationTriangle,
  heroInformationCircle,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { ConfirmDialogService, ConfirmDialogType } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      heroExclamationTriangle,
      heroInformationCircle,
      heroTrash,
      heroXMark,
    }),
  ],
  templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
  protected readonly confirmService = inject(ConfirmDialogService);

  // Inputs opcionales para uso declarativo como componente
  readonly isOpen = input<boolean | null>(null);
  readonly title = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly type = input<ConfirmDialogType | null>(null);
  readonly confirmText = input<string | null>(null);
  readonly cancelText = input<string | null>(null);
  readonly icon = input<string | null>(null);

  // Outputs para uso declarativo
  readonly confirm = output<void>();
  readonly cancel = output<void>();

  // Computados que priorizan inputs directos o fallback al servicio
  readonly isModalOpen = computed(() => {
    return this.isOpen() !== null ? !!this.isOpen() : this.confirmService.isOpen();
  });

  readonly displayTitle = computed(() => {
    return this.title() || this.confirmService.options()?.title || '¿Estás seguro?';
  });

  readonly displayMessage = computed(() => {
    return this.message() || this.confirmService.options()?.message || '';
  });

  readonly displayType = computed<ConfirmDialogType>(() => {
    return this.type() || this.confirmService.options()?.type || 'danger';
  });

  readonly displayConfirmText = computed(() => {
    return this.confirmText() || this.confirmService.options()?.confirmText || 'Confirmar';
  });

  readonly displayCancelText = computed(() => {
    return this.cancelText() || this.confirmService.options()?.cancelText || 'Cancelar';
  });

  readonly displayIcon = computed(() => {
    if (this.icon()) return this.icon()!;
    if (this.confirmService.options()?.icon) return this.confirmService.options()!.icon!;
    switch (this.displayType()) {
      case 'danger':
        return 'heroTrash';
      case 'warning':
        return 'heroExclamationTriangle';
      case 'info':
        return 'heroInformationCircle';
      default:
        return 'heroExclamationTriangle';
    }
  });

  onConfirm(): void {
    if (this.isOpen() !== null) {
      this.confirm.emit();
    } else {
      this.confirmService.handleConfirm();
    }
  }

  onCancel(): void {
    if (this.isOpen() !== null) {
      this.cancel.emit();
    } else {
      this.confirmService.handleCancel();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isModalOpen()) {
      this.onCancel();
    }
  }
}
