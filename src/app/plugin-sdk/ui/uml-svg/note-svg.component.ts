import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente SVG para representar el icono y miniatura de una Nota Flotante (Sticky Note / Comentario UML)
 * utilizada para comunicación del equipo sin participar en la generación de código.
 */
@Component({
  selector: 'app-note-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 48 38"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 7 5 L 33 5 L 41 13 L 41 33 L 7 33 Z"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linejoin="round"
      />
      <path
        d="M 33 5 L 33 13 L 41 13"
        fill="#FDE047"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linejoin="round"
      />
      <line x1="12" y1="18" x2="35" y2="18" [attr.stroke]="strokeColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65" />
      <line x1="12" y1="24" x2="29" y2="24" [attr.stroke]="strokeColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65" />
    </svg>
  `,
})
export class NoteSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FEF9C3';
  @Input() strokeColor: string = '#A16207';
  @Input() strokeWidth: number = 1.6;
  @Input() className: string = 'w-full h-full';
}
