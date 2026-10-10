import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationGlComponent } from './communication-gl.component';

/**
 * UML 2.5 Robustness Boundary WebGL/WebGPU Component
 * Renders the boundary/interface element (circle connected to vertical boundary line)
 * with GPU shader acceleration.
 */
@Component({
  selector: 'app-boundary-gl',
  standalone: true,
  imports: [CommonModule, CommunicationGlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      max-width: 100%;
      max-height: 100%;
      box-sizing: border-box;
    }
  `],
  host: {
    '[style.width]': 'computedWidth',
    '[style.height]': 'computedHeight',
    '[style.display]': "width === '100%' ? 'flex' : 'inline-flex'",
    'class': 'shrink-0'
  },
  template: `
    <app-communication-gl
      class="w-full h-full"
      type="boundary"
      [width]="width"
      [height]="height"
      [fillColor]="fillColor"
      [strokeColor]="strokeColor"
      [strokeWidth]="strokeWidth"
      [zoom]="zoom"
      [className]="className"
    />
  `
})
export class BoundaryGlComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.35;
  @Input() zoom: number = 100;
  @Input() className: string = '';

  get isCustomSize(): boolean {
    return this.width !== '100%' || this.height !== '100%';
  }

  get computedWidth(): string {
    if (typeof this.width === 'number') return `${this.width}px`;
    return this.width;
  }

  get computedHeight(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    return this.height;
  }
}
