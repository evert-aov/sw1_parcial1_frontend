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
  showCancelButton?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  readonly isOpen = signal<boolean>(false);
  readonly options = signal<ConfirmDialogOptions | null>(null);

  private resolver: ((value: boolean) => void) | null = null;

  /**
   * Abre un modal de confirmación asíncrono con opciones de aceptar y cancelar.
   * @param options Configuración del diálogo (título, mensaje, textos de botones y estilo).
   * @returns Promesa que resuelve a `true` si el usuario confirma o `false` si cancela.
   */
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
      showCancelButton: options.showCancelButton ?? true,
    });
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  /**
   * Abre un diálogo de alerta modal con un único botón de entendido/aceptar.
   * @param options Configuración de la alerta.
   * @returns Promesa que resuelve a `true` tras presionar el botón de confirmación.
   */
  alert(options: ConfirmDialogOptions): Promise<boolean> {
    return this.confirm({
      ...options,
      type: options.type || 'warning',
      showCancelButton: options.showCancelButton ?? false,
      confirmText: options.confirmText || 'common.confirmModal.understood',
    });
  }

  /**
   * Manejador de confirmación: cierra el modal y resuelve la promesa pendiente como verdadera.
   */
  handleConfirm(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(true);
      this.resolver = null;
    }
  }

  /**
   * Manejador de cancelación o cierre: oculta el diálogo y resuelve la promesa como falsa.
   */
  handleCancel(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
  }
}
