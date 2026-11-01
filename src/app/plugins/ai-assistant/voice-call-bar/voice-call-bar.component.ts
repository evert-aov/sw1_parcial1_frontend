import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroChatBubbleLeftRight,
  heroMicrophone,
  heroSpeakerWave,
  heroSpeakerXMark,
  heroNoSymbol,
  heroPhoneXMark,
  heroSparkles,
} from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../core/i18n/index';
import { AiAssistantCoordinatorService } from '../ai-assistant-coordinator.service';
import { ChatSpeechService } from '../chat-speech.service';
import { VoiceCallService } from '../voice-call.service';

/**
 * Superficie flotante de llamada grupal y diálogo de permiso explícito de Kanon.
 * Permanece viva aunque el usuario cierre el panel lateral derecho para ampliar su lienzo.
 */
@Component({
  selector: 'app-voice-call-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroMicrophone,
  heroSpeakerWave,
  heroSpeakerXMark,
      heroNoSymbol,
      heroPhoneXMark,
      heroSparkles,
      heroChatBubbleLeftRight,
    }),
  ],
  styles: [`
/* Las ondas se dibujan fuera del control sin reservar espacio del lienzo. */
.voice-waves { position: relative; isolation: isolate; }
.voice-waves::before, .voice-waves::after {
  content: ''; position: absolute; inset: 2px; border: 1px solid currentColor;
  border-radius: 50%; pointer-events: none; animation: kanon-wave 1.6s ease-out infinite;
}
.voice-waves::after { animation-delay: .8s; }
@keyframes kanon-wave { from { transform: scale(.8); opacity: .65; } to { transform: scale(1.65); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .voice-waves::before, .voice-waves::after { animation: none; opacity: .35; }
}
.ai-speaking-glow {
  color: #e9d5ff !important;
  background: rgba(168, 85, 247, 0.35) !important;
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.85) !important;
  animation: ai-pill-pulse 1.2s ease-in-out infinite alternate !important;
}
@keyframes ai-pill-pulse {
  from { transform: scale(1); box-shadow: 0 0 8px rgba(168, 85, 247, 0.6); }
  to { transform: scale(1.1); box-shadow: 0 0 20px rgba(168, 85, 247, 0.95); }
}
`],
  template: `
    <!-- Modal de permiso explícito individual para que Kanon escuche al participante -->
    @if (call.consentModalDiagramId()) {
      <div
        class="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        (click)="call.cancelJoinPrompt()"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12162B] p-5 shadow-2xl space-y-4 text-xs"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'chat.callConsentTitle' | translate"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 text-white flex items-center justify-center shrink-0 shadow-md"
            >
              <ng-icon name="heroSparkles" class="text-lg" />
            </div>
            <div class="space-y-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ 'chat.callConsentTitle' | translate }}
              </h3>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ 'chat.callConsentDesc' | translate }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              (click)="call.cancelJoinPrompt()"
              class="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
            >
              {{ 'common.cancel' | translate }}
            </button>
            <button
              type="button"
              data-testid="call-consent-deny"
              (click)="call.confirmJoin(false)"
              class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              {{ 'chat.callConsentDeny' | translate }}
            </button>
            <button
              type="button"
              data-testid="call-consent-allow"
              (click)="call.confirmJoin(true)"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <ng-icon name="heroSparkles" class="text-sm" />
              <span>{{ 'chat.callConsentAllow' | translate }}</span>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal de solicitud colectiva de consentimiento unánime para que Kanon entre a la llamada -->
    @if (call.aiConsentRequest(); as req) {
      <div
        class="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'chat.aiConsentRequestTitle' | translate"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-purple-300/40 dark:border-purple-800 bg-white dark:bg-[#12162B] p-5 shadow-2xl space-y-4 text-xs"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse"
            >
              <ng-icon name="heroSparkles" class="text-lg" />
            </div>
            <div class="space-y-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ 'chat.aiConsentRequestTitle' | translate }}
              </h3>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ 'chat.aiConsentRequestDesc' | translate: { name: req.requestedBy.displayName } }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              data-testid="ai-consent-deny-btn"
              (click)="call.respondAiConsent(false)"
              class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              {{ 'chat.callConsentDeny' | translate }}
            </button>
            <button
              type="button"
              data-testid="ai-consent-allow-btn"
              (click)="call.respondAiConsent(true)"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <ng-icon name="heroSparkles" class="text-sm" />
              <span>{{ 'chat.callConsentAllow' | translate }}</span>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Píldora flotante compacta cuando el usuario está en llamada y el panel lateral está cerrado -->
    @if (call.inCall() && !isPanelOpen()) {
      <div
        data-testid="floating-call-pill"
        class="fixed bottom-11 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/95 dark:bg-[#131830]/95 text-white border border-indigo-500/40 shadow-2xl backdrop-blur-md text-xs"
      >
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
          [class.bg-emerald-400]="!call.muted() && !call.liveAudio.playing() && !speech.playing()"
          [class.bg-purple-400]="call.liveAudio.playing() || !!speech.playing()"
          [class.scale-125]="call.localSpeaking() || call.liveAudio.playing()"
          [class.voice-waves]="call.localSpeaking() || call.sendingAudio() || !!speech.playing() || call.liveAudio.playing()"
          [class.bg-rose-400]="call.muted() && !call.liveAudio.playing() && !speech.playing()"
        ></span>

        <span class="font-semibold whitespace-nowrap">
          {{ 'chat.callParticipantsCount' | translate: { count: call.participants().length || 1 } }}
        </span>

        <div class="flex -space-x-1.5 px-1">
          @for (p of call.participants().slice(0, 4); track p.socketId) {
            <span
              class="w-6 h-6 rounded-full bg-indigo-600 border border-slate-900 flex items-center justify-center text-[10px] font-bold"
              [title]="p.displayName"
            >
              {{ p.displayName.charAt(0).toUpperCase() }}
            </span>
          }
        </div>

        <button
          type="button"
          (click)="call.toggleMute()"
          [attr.aria-pressed]="!call.muted()"
          [title]="(call.muted() ? 'chat.unmuteMic' : 'chat.muteMic') | translate"
          class="p-1.5 rounded-full transition-colors cursor-pointer"
          [class.ai-speaking-glow]="call.liveAudio.playing() || !!speech.playing()"
          [class.bg-rose-600]="call.muted() && !call.liveAudio.playing() && !speech.playing()"
          [class.bg-white/10]="!call.muted() && !call.liveAudio.playing() && !speech.playing()"
          [class.hover:bg-white/20]="!call.muted()"
        >
          <ng-icon [name]="call.muted() ? 'heroNoSymbol' : 'heroMicrophone'" class="text-sm" />
        </button>

        <button type="button" (click)="speech.toggleMuted()"
          [title]="(speech.muted() ? 'chat.unmuteSpeaker' : 'chat.muteSpeaker') | translate"
          [attr.aria-label]="(speech.muted() ? 'chat.unmuteSpeaker' : 'chat.muteSpeaker') | translate"
          [attr.aria-pressed]="!speech.muted()" class="p-1.5 rounded-full transition-colors cursor-pointer"
          [class.ai-speaking-glow]="call.liveAudio.playing() || !!speech.playing()"
          [class.bg-white/10]="!call.liveAudio.playing() && !speech.playing()">
          <ng-icon [name]="speech.muted() ? 'heroSpeakerXMark' : 'heroSpeakerWave'" />
        </button>

        <button
          type="button"
          (click)="call.toggleAiConsent()"
          [title]="(call.aiConsent() ? (call.liveConnected() ? 'chat.kanonListeningOn' : 'chat.liveConnecting') : 'chat.kanonListeningOff') | translate"
          class="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          [class.bg-purple-600]="call.aiConsent()"
          [class.text-white]="call.aiConsent()"
          [class.bg-white/10]="!call.aiConsent()"
          [class.text-slate-300]="!call.aiConsent()"
        >
          <ng-icon name="heroSparkles" class="text-xs" />
          <span>{{ (call.aiConsent() ? (call.liveConnected() ? 'chat.kanonListeningOn' : 'chat.liveConnecting') : 'chat.kanonListeningOff') | translate }}</span>
        </button>

        <button
          type="button"
          (click)="coordinator.requestOpenPanel(call.callScope())"
          [title]="'chat.openChatFromCall' | translate"
          class="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ng-icon name="heroChatBubbleLeftRight" class="text-sm" />
        </button>

        <button
          type="button"
          (click)="call.leaveCall()"
          [title]="'chat.leaveCall' | translate"
          class="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
        >
          <ng-icon name="heroPhoneXMark" class="text-sm" />
        </button>
      </div>
    }
  `,
})
export class VoiceCallBarComponent implements OnDestroy {
  readonly isPanelOpen = input(false);
  readonly diagramId = input<string | null>(null);
  readonly speech = inject(ChatSpeechService);
  readonly call = inject(VoiceCallService);
  readonly coordinator = inject(AiAssistantCoordinatorService);

  constructor() {
    effect(() => {
      const currentId = this.diagramId();
      untracked(() => {
        if (this.call.inCall() && this.call.activeDiagramId() && this.call.activeDiagramId() !== currentId) {
          this.call.leaveCall();
        }
      });
    });
  }

  /** Cierra la llamada activa si el usuario abandona la vista del editor de diagramas. */
  ngOnDestroy(): void {
    if (this.call.inCall()) {
      this.call.leaveCall();
    }
  }
}
