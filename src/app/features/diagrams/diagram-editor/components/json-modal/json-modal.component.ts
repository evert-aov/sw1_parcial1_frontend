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
import { TranslatePipe } from '../../../../../core/i18n';

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

  readonly jsonContent = signal<string>('');

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          this.jsonContent.set(this.initialJson());
        }
      },
      { allowSignalWrites: true }
    );
  }

  copyToClipboard(): void {
    if (this.jsonContent()) {
      navigator.clipboard.writeText(this.jsonContent());
    }
  }

  onApply(): void {
    this.applyImport.emit(this.jsonContent());
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
