import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../../core/i18n';
import { UmlLineStyle } from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-statusbar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './diagram-statusbar.component.html',
})
export class DiagramStatusbarComponent {
  readonly isConnected = input<boolean>(false);
  readonly classCount = input<number>(0);
  readonly relationCount = input<number>(0);
  readonly lineStyle = input<UmlLineStyle>('segment');
  readonly zoomLevel = input<number>(100);

  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetView = output<void>();
}
