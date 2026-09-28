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

  openGuide(prompt?: string): void {
    if (prompt) {
      this.initialPrompt.set(prompt);
    }
    this.isOpen.set(true);
  }

  closeGuide(): void {
    this.isOpen.set(false);
  }

  toggleGuide(): void {
    this.isOpen.update((v) => !v);
  }

  hideLauncher(): void {
    this.isLauncherHidden.set(true);
    try {
      localStorage.setItem('user_guide_launcher_hidden', 'true');
    } catch {}
  }

  showLauncher(): void {
    this.isLauncherHidden.set(false);
    try {
      localStorage.removeItem('user_guide_launcher_hidden');
    } catch {}
  }

  toggleLauncher(): void {
    if (this.isLauncherHidden()) {
      this.showLauncher();
    } else {
      this.hideLauncher();
    }
  }
}

