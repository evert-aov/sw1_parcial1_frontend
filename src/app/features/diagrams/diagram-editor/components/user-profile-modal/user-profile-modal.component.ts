import { Component, inject, signal, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroUserCircle, heroXMark, heroCheck } from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-user-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      heroUserCircle,
      heroXMark,
      heroCheck,
    }),
  ],
  templateUrl: './user-profile-modal.component.html',
})
export class UserProfileModalComponent {
  readonly authService = inject(AuthService);

  readonly isOpen = input<boolean>(false);
  readonly close = output<void>();

  readonly isRefreshing = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly editFullName = signal<string>('');
  readonly editPassword = signal<string>('');
  readonly saveSuccessMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.editFullName.set(this.authService.currentUser()?.fullName || '');
        this.editPassword.set('');
        this.saveSuccessMessage.set(null);
        this.refreshProfile();
      }
    });
  }

  closeModal(): void {
    this.close.emit();
  }

  refreshProfile(): void {
    this.isRefreshing.set(true);
    this.authService.fetchProfile().subscribe({
      next: (user) => {
        this.isRefreshing.set(false);
        if (!this.editFullName()) {
          this.editFullName.set(user.fullName || '');
        }
      },
      error: () => {
        this.isRefreshing.set(false);
      },
    });
  }

  saveProfile(): void {
    const fullName = this.editFullName().trim();
    if (!fullName) {
      alert('El nombre completo no puede estar vacío.');
      return;
    }

    const password = this.editPassword().trim();
    if (password && password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isSaving.set(true);
    const payload: { fullName?: string; password?: string } = { fullName };
    if (password) {
      payload.password = password;
    }

    this.authService.updateProfile(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editPassword.set('');
        this.saveSuccessMessage.set('¡Perfil y datos actualizados con éxito!');
        setTimeout(() => this.saveSuccessMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        alert('Error al actualizar el perfil: ' + (err.error?.message || err.message));
      },
    });
  }
}
