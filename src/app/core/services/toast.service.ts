import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4000
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  /**
   * Muestra una notificación flotante (toast) con el mensaje, tipo y duración especificados.
   * @param message Texto del mensaje a desplegar.
   * @param type Tipo visual de la notificación ('info' | 'success' | 'error' | 'warning').
   * @param duration Duración en milisegundos antes del autocierre (0 para persistente).
   */
  show(message: string, type: ToastType = 'info', duration = 4000): void {
    const id = crypto.randomUUID();
    this._toasts.update(t => [...t, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  /**
   * Muestra un toast de éxito con estilo visual verde.
   * @param message Mensaje informativo de éxito.
   * @param duration Duración en milisegundos (por defecto 4000).
   */
  success(message: string, duration = 4000): void { this.show(message, 'success', duration); }

  /**
   * Muestra un toast de error con estilo visual rojo.
   * @param message Mensaje descriptivo del error.
   * @param duration Duración en milisegundos (por defecto 5000).
   */
  error(message: string, duration = 5000): void { this.show(message, 'error', duration); }

  /**
   * Muestra un toast de advertencia con estilo visual ámbar.
   * @param message Mensaje de alerta o precaución.
   * @param duration Duración en milisegundos (por defecto 4500).
   */
  warning(message: string, duration = 4500): void { this.show(message, 'warning', duration); }

  /**
   * Muestra un toast informativo genérico con estilo visual azul.
   * @param message Mensaje informativo.
   * @param duration Duración en milisegundos (por defecto 4000).
   */
  info(message: string, duration = 4000): void { this.show(message, 'info', duration); }

  /**
   * Descarta y remueve inmediatamente un toast activo por su identificador.
   * @param id Identificador único del toast.
   */
  dismiss(id: string): void {
    this._toasts.update(t => t.filter(toast => toast.id !== id));
  }

  /**
   * Limpia y descarta todas las notificaciones toast activas en pantalla.
   */
  clear(): void {
    this._toasts.set([]);
  }
}
