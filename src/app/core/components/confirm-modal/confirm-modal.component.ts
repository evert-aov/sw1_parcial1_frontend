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
import { TranslationService } from '../../i18n';

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
  protected readonly translationService = inject(TranslationService);

  // Inputs opcionales para uso declarativo como componente
  readonly isOpen = input<boolean | null>(null);
  readonly title = input<string | null>(null);
  readonly titleParams = input<Record<string, any> | null>(null);
  readonly message = input<string | null>(null);
  readonly messageParams = input<Record<string, any> | null>(null);
  readonly type = input<ConfirmDialogType | null>(null);
  readonly confirmText = input<string | null>(null);
  readonly cancelText = input<string | null>(null);
  readonly icon = input<string | null>(null);
  readonly showCancelButton = input<boolean | null>(null);

  // Outputs para uso declarativo
  readonly confirm = output<void>();
  readonly cancel = output<void>();

  // Computados que priorizan inputs directos o fallback al servicio
  readonly isModalOpen = computed(() => {
    return this.isOpen() !== null ? !!this.isOpen() : this.confirmService.isOpen();
  });

  readonly displayShowCancelButton = computed(() => {
    if (this.showCancelButton() !== null) return !!this.showCancelButton();
    const optVal = this.confirmService.options()?.showCancelButton;
    return optVal !== undefined ? optVal : true;
  });

  readonly displayTitle = computed(() => {
    this.translationService.currentLang();
    const raw = this.title() || this.confirmService.options()?.title;
    const params = this.titleParams() || this.confirmService.options()?.titleParams;
    if (!raw) return this.translationService.translate('common.confirmModal.defaultTitle');
    return this.translationService.translate(raw, params || undefined);
  });

  readonly displayMessage = computed(() => {
    this.translationService.currentLang();
    const raw = this.message() || this.confirmService.options()?.message || '';
    const params = this.messageParams() || this.confirmService.options()?.messageParams;
    return this.translationService.translate(raw, params || undefined);
  });

  readonly displayType = computed<ConfirmDialogType>(() => {
    return this.type() || this.confirmService.options()?.type || 'danger';
  });

  readonly displayConfirmText = computed(() => {
    this.translationService.currentLang();
    const raw = this.confirmText() || this.confirmService.options()?.confirmText;
    if (raw) return this.translationService.translate(raw);
    if (!this.displayShowCancelButton()) return this.translationService.translate('common.confirmModal.understood');
    const type = this.displayType();
    if (type === 'danger') return this.translationService.translate('common.confirmModal.defaultDangerConfirm');
    if (type === 'warning') return this.translationService.translate('common.confirmModal.defaultWarningConfirm');
    return this.translationService.translate('common.confirmModal.defaultInfoConfirm');
  });

  readonly displayCancelText = computed(() => {
    this.translationService.currentLang();
    const raw = this.cancelText() || this.confirmService.options()?.cancelText;
    if (raw) return this.translationService.translate(raw);
    return this.translationService.translate('common.confirmModal.cancel');
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
