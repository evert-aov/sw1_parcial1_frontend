import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserGuideChatbotComponent } from './core/components/user-guide-chatbot/user-guide-chatbot.component';
import { ConfirmModalComponent } from './core/components/confirm-modal/confirm-modal.component';

@Component({
  imports: [RouterOutlet, UserGuideChatbotComponent, ConfirmModalComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
