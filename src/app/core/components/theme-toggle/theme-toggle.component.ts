import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroSun, heroMoon } from '@ng-icons/heroicons/outline';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { TranslatePipe } from '../../i18n';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  viewProviders: [provideIcons({ heroSun, heroMoon })],
  template: `
    <!-- Toggle de Tema Estilo Píldora Moderno (SaaS / Figma) -->
    <div class="inline-flex items-center rounded-full bg-slate-100 dark:bg-[#161B32] p-0.5 border border-slate-200/80 dark:border-slate-700/60 select-none shadow-2xs">
      <button
        type="button"
        (click)="setTheme('light')"
        [attr.aria-pressed]="!isDarkMode()"
        [title]="'theme.light' | translate"
        [class.bg-white]="!isDarkMode()"
        [class.text-amber-500]="!isDarkMode()"
        [class.shadow-xs]="!isDarkMode()"
        [class.text-slate-400]="isDarkMode()"
        class="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:text-amber-500">
        <ng-icon name="heroSun" class="text-xs"></ng-icon>
      </button>
      <button
        type="button"
        (click)="setTheme('dark')"
        [attr.aria-pressed]="isDarkMode()"
        [title]="'theme.dark' | translate"
        [class.bg-[#0D1124]]="isDarkMode()"
        [class.text-indigo-400]="isDarkMode()"
        [class.shadow-xs]="isDarkMode()"
        [class.text-slate-400]="!isDarkMode()"
        class="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:text-indigo-400">
        <ng-icon name="heroMoon" class="text-xs"></ng-icon>
      </button>
    </div>
  `,
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);

  readonly variant = input<'dark' | 'light' | 'auto'>('auto');
  readonly isDarkMode = this.themeService.isDarkMode;

  setTheme(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
