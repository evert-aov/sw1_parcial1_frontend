import { Component, inject, input, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';
import { SupportedLanguage } from '../../models/language.type';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ heroChevronDown })],
  template: `
    <div class="relative inline-block text-left select-none">
      <!-- Botón Selector Principal (Idéntico a la captura: 🇪🇸 ES ▾) -->
      <button
        type="button"
        (click)="isOpen.set(!isOpen())"
        title="Seleccionar idioma / Select language"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-[#161B32] hover:bg-slate-200/70 dark:hover:bg-[#1E2548] border border-slate-200/80 dark:border-slate-700/60 shadow-2xs transition-colors cursor-pointer">
        <span>{{ currentLang() === 'es' ? '🇪🇸' : '🇺🇸' }}</span>
        <span class="text-[11px] font-bold">{{ currentLang() === 'es' ? 'ES' : 'EN' }}</span>
        <ng-icon name="heroChevronDown" class="text-[10px] text-slate-400"></ng-icon>
      </button>

      <!-- Menú Desplegable -->
      @if (isOpen()) {
        <div
          class="absolute right-0 mt-1 w-32 rounded-xl bg-white dark:bg-[#131830] border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            (click)="selectLang('es')"
            [class.bg-blue-50]="currentLang() === 'es'"
            [class.dark:bg-blue-950/60]="currentLang() === 'es'"
            [class.text-blue-600]="currentLang() === 'es'"
            [class.dark:text-blue-400]="currentLang() === 'es'"
            class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#1C2242] transition-colors cursor-pointer">
            <span class="flex items-center gap-2">
              <span>🇪🇸</span>
              <span class="font-medium">Español</span>
            </span>
            @if (currentLang() === 'es') {
              <span class="text-xs font-bold">✓</span>
            }
          </button>
          <button
            type="button"
            (click)="selectLang('en')"
            [class.bg-blue-50]="currentLang() === 'en'"
            [class.dark:bg-blue-950/60]="currentLang() === 'en'"
            [class.text-blue-600]="currentLang() === 'en'"
            [class.dark:text-blue-400]="currentLang() === 'en'"
            class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#1C2242] transition-colors cursor-pointer">
            <span class="flex items-center gap-2">
              <span>🇺🇸</span>
              <span class="font-medium">English</span>
            </span>
            @if (currentLang() === 'en') {
              <span class="text-xs font-bold">✓</span>
            }
          </button>
        </div>
      }
    </div>
  `,
})
export class LanguageSelectorComponent {
  private readonly translationService = inject(TranslationService);
  private readonly elementRef = inject(ElementRef);

  readonly theme = input<'dark' | 'light'>('light');
  readonly currentLang = this.translationService.currentLang;
  readonly isOpen = signal<boolean>(false);

  /**
   * Cambia el idioma activo de la aplicación y cierra el menú desplegable.
   * @param lang Código del idioma seleccionado ('es' o 'en').
   */
  selectLang(lang: SupportedLanguage): void {
    this.translationService.setLanguage(lang);
    this.isOpen.set(false);
  }

  /**
   * Cierra el menú desplegable si el usuario hace clic fuera de los límites del componente.
   * @param event Evento MouseEvent global.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
