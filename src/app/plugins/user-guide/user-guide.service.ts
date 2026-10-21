import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UserGuideService {
  readonly isOpen = signal<boolean>(false);
  readonly initialPrompt = signal<string | null>(null);
  readonly isLauncherHidden = signal<boolean>(false);

  constructor() {
    try {
      const savedHidden = localStorage.getItem('user_guide_launcher_hidden');
      if (savedHidden === 'true') {
        this.isLauncherHidden.set(true);
      }
    } catch {}
  }

  /**
   * Abre la ventana del asistente virtual/guía de usuario, opcionalmente enviando una consulta inicial.
   * @param prompt Mensaje o consulta inicial opcional.
   */
  openGuide(prompt?: string): void {
    if (prompt) {
      this.initialPrompt.set(prompt);
    }
    this.isOpen.set(true);
  }

  /**
   * Cierra la ventana del asistente virtual.
   */
  closeGuide(): void {
    this.isOpen.set(false);
  }

  /**
   * Alterna la visibilidad de la ventana del asistente virtual.
   */
  toggleGuide(): void {
    this.isOpen.update((v) => !v);
  }

  /**
   * Oculta el botón flotante lanzador del asistente y persiste la preferencia en localStorage.
   */
  hideLauncher(): void {
    this.isLauncherHidden.set(true);
    try {
      localStorage.setItem('user_guide_launcher_hidden', 'true');
    } catch {}
  }

  /**
   * Muestra el botón flotante lanzador del asistente y remueve la restricción de localStorage.
   */
  showLauncher(): void {
    this.isLauncherHidden.set(false);
    try {
      localStorage.removeItem('user_guide_launcher_hidden');
    } catch {}
  }

  /**
   * Alterna la visibilidad del botón flotante lanzador.
   */
  toggleLauncher(): void {
    if (this.isLauncherHidden()) {
      this.showLauncher();
    } else {
      this.hideLauncher();
    }
  }
}

