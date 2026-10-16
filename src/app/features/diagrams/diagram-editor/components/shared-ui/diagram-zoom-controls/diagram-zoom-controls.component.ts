import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroMagnifyingGlassPlus,
  heroMagnifyingGlassMinus,
  heroArrowsPointingOut,
} from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../../core/i18n';

@Component({
  selector: 'app-diagram-zoom-controls',
  standalone: true,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroMagnifyingGlassPlus,
      heroMagnifyingGlassMinus,
      heroArrowsPointingOut,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-zoom-controls.component.html',
})
export class DiagramZoomControlsComponent {
  @Input() variant: 'grid' | 'flex' = 'grid';

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() resetView = new EventEmitter<void>();
  @Output() fitView = new EventEmitter<void>();
}
