import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroDocumentText,
  heroXMark,
  heroClipboardDocument,
  heroCheck,
} from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n/index';

@Component({
  selector: 'app-json-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroDocumentText,
      heroXMark,
      heroClipboardDocument,
      heroCheck,
    }),
  ],
  templateUrl: './json-modal.component.html',
})
export class JsonModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly mode = input<'export' | 'import'>('export');
  readonly initialJson = input<string>('');

  readonly close = output<void>();
  readonly applyImport = output<string>();
  readonly copied = output<void>();

  readonly jsonContent = signal<string>('');
  readonly isCopied = signal<boolean>(false);
  private copyTimeout: any = null;

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          this.jsonContent.set(this.initialJson());
          this.isCopied.set(false);
        }
      },
      { allowSignalWrites: true }
    );
  }

  /**
   * Copia el texto JSON al portapapeles del sistema y activa el estado visual temporal de copiado.
   */
  async copyToClipboard(): Promise<void> {
    const text = this.jsonContent();
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      this.isCopied.set(true);
      this.copied.emit();

      if (this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }
      this.copyTimeout = setTimeout(() => {
        this.isCopied.set(false);
      }, 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  }

  /**
   * Aplica el JSON ingresado en modo importación hacia el editor y cierra la ventana.
   */
  onApply(): void {
    this.applyImport.emit(this.jsonContent());
    this.close.emit();
  }

  /**
   * Cierra el modal JSON limpiando temporizadores pendientes.
   */
  onClose(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
    this.isCopied.set(false);
    this.close.emit();
  }
}
