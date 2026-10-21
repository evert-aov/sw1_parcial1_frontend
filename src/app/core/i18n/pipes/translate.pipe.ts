import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

/**
 * Pipe standalone para traducción reactiva de textos en plantillas Angular.
 * Uso: {{ 'auth.login.title' | translate }} o {{ 'projects.diagramsCount' | translate:{ count: 4 } }}
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly translationService = inject(TranslationService);

  /**
   * Transforma una clave de traducción en el texto localizado en el idioma actual, interpolando parámetros opcionales.
   * @param key Clave jerárquica de internacionalización (ej. 'auth.login.title').
   * @param params Diccionario opcional de variables a interpolar.
   * @returns Cadena traducida.
   */
  transform(key: string, params?: Record<string, string | number>): string {
    if (!key) return '';
    // Consumir el signal currentLang para registrar la dependencia reactiva
    this.translationService.currentLang();
    return this.translationService.translate(key, params);
  }
}
