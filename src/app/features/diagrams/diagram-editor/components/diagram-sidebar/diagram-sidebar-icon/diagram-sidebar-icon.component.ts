import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-diagram-sidebar-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (type) {
      @case ('actor') {
        <!-- Monigote UML Actor -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <circle cx="12" cy="5" r="3.5" />
          <line x1="12" y1="8.5" x2="12" y2="16" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="12" y1="16" x2="7" y2="22" />
          <line x1="12" y1="16" x2="17" y2="22" />
        </svg>
      }
      @case ('use_case') {
        <!-- Elipse UML Use Case -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" [class]="className">
          <ellipse cx="12" cy="12" rx="10" ry="7" />
        </svg>
      }
      @case ('table') {
        <!-- Tabla ER / Datos -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="12" y1="9" x2="12" y2="21" />
        </svg>
      }
      @case ('boundary') {
        <!-- Robustness Boundary -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" [class]="className">
          <line x1="3" y1="4" x2="3" y2="20" />
          <line x1="3" y1="12" x2="9" y2="12" />
          <circle cx="15" cy="12" r="6" />
        </svg>
      }
      @case ('control') {
        <!-- Robustness Control -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5 L16 2 M12 5 L16 8" />
        </svg>
      }
      @case ('entity') {
        <!-- Robustness Entity -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" [class]="className">
          <circle cx="12" cy="11" r="7" />
          <line x1="5" y1="21" x2="19" y2="21" />
        </svg>
      }
      @case ('lifeline') {
        <!-- Secuencia Línea de Vida -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" [class]="className">
          <rect x="5" y="2" width="14" height="7" rx="1" />
          <line x1="12" y1="9" x2="12" y2="22" stroke-dasharray="2,2" />
        </svg>
      }
      @case ('deployment_node') {
        <!-- Nodo de Despliegue (Cubo 3D) -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
          <line x1="12" y1="2" x2="12" y2="12" />
          <line x1="12" y1="12" x2="21" y2="7" />
          <line x1="12" y1="12" x2="3" y2="7" />
        </svg>
      }
      @case ('component') {
        <!-- Componente UML -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <rect x="6" y="3" width="15" height="18" rx="1.5" />
          <rect x="3" y="6" width="6" height="4" rx="0.5" fill="#FFFFFF" />
          <rect x="3" y="14" width="6" height="4" rx="0.5" fill="#FFFFFF" />
        </svg>
      }
      @case ('boundary_box') {
        <!-- Caja Límite / Paquete -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-dasharray="3,2" [class]="className">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      }
      @case ('directory') {
        <!-- Carpeta / Directorio -->
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [class]="className">
          <path d="M3 6 C3 4.9 3.9 4 5 4 L9 4 L11 7 L19 7 C20.1 7 21 7.9 21 9 L21 18 C21 19.1 20.1 20 19 20 L5 20 C3.9 20 3 19.1 3 18 Z" />
        </svg>
      }
      @default {
        <svg [attr.width]="width" [attr.height]="height" viewBox="0 0 24 24" fill="none" [attr.stroke]="strokeColor" stroke-width="1.8" [class]="className">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      }
    }
  `,
})
export class DiagramSidebarIconComponent {
  @Input() type = 'default';
  @Input() width: number | string = 18;
  @Input() height: number | string = 18;
  @Input() strokeColor = 'currentColor';
  @Input() className = '';
  @Input() strokeWidth = 1.8;
  @Input() mode: 'icon' | 'preview' | 'glyph' | string = 'icon';
}
