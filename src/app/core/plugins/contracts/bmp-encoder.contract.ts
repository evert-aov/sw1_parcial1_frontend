import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';

export interface BmpEncoder {
  encodeImageDataToBmp(imageData: ImageData): Promise<ArrayBuffer>;
  convertImageDataToBmp(imageData: ImageData): ArrayBuffer;
}
export const BmpEncoder: InjectionToken<BmpEncoder> = new InjectionToken<BmpEncoder>(
  'BMP encoder',
  {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(BmpEncoder),
  },
);
