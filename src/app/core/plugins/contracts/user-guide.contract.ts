import { InjectionToken, WritableSignal, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
export interface UserGuideService {
  readonly isOpen: WritableSignal<boolean>;
  readonly initialPrompt: WritableSignal<string | null>;
  readonly isLauncherHidden: WritableSignal<boolean>;
  openGuide(prompt?: string): void;
  closeGuide(): void;
  toggleGuide(): void;
  hideLauncher(): void;
  showLauncher(): void;
  toggleLauncher(): void;
}
export const UserGuideService: InjectionToken<UserGuideService> =
  new InjectionToken<UserGuideService>('User guide', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(UserGuideService),
  });
