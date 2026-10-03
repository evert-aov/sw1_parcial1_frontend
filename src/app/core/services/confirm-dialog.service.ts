import { Injectable, signal } from '@angular/core';

export type ConfirmDialogType = 'danger' | 'warning' | 'info';

export interface ConfirmDialogOptions {
  title?: string;
  titleParams?: Record<string, any>;
  message: string;
  messageParams?: Record<string, any>;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmDialogType;
  icon?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  readonly isOpen = signal<boolean>(false);
  readonly options = signal<ConfirmDialogOptions | null>(null);

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    // Si ya había un diálogo abierto, resolverlo como false
    if (this.resolver) {
      this.resolver(false);
    }

    this.options.set({
      title: options.title || 'common.confirmModal.defaultTitle',
      titleParams: options.titleParams,
      message: options.message,
      messageParams: options.messageParams,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      type: options.type || 'danger',
      icon: options.icon,
    });
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  handleConfirm(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(true);
      this.resolver = null;
    }
  }

  handleCancel(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
  }
}
