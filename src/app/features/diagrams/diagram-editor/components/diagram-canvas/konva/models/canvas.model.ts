export type ShapeType = 'rect' | 'circle' | 'star' | 'polygon' | 'arrow' | 'text' | 'path' | 'ring';

export type ToolMode = 'select' | 'pan' | 'brush' | 'rect' | 'circle' | 'star' | 'polygon' | 'arrow' | 'text' | 'ring';

export interface CanvasElement {
  id: string;
  name: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  innerRadius?: number;
  outerRadius?: number;
  numPoints?: number;
  sides?: number;
  points?: number[];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'bold' | 'italic';
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  cornerRadius?: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  visible: boolean;
  locked: boolean;
  blurRadius?: number;
}

export interface PresetScene {
  id: string;
  title: string;
  category: string;
  description: string;
  background: string;
  elements: CanvasElement[];
}
