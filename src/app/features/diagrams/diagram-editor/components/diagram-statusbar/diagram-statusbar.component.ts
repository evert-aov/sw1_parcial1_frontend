import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../../core/i18n/index';

@Component({
  selector: 'app-diagram-statusbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './diagram-statusbar.component.html',
  styleUrl: './diagram-statusbar.component.css',
})
export class DiagramStatusbarComponent {
  readonly isConnected = input<boolean>(false);
  readonly nodeCount = input<number>(0);
  readonly relationCount = input<number>(0);
  readonly selectedCount = input<number>(0);
  readonly zoomLevel = input<number>(100);

  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetView = output<void>();
}
