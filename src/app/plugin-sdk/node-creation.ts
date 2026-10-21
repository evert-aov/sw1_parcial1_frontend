import { NodeCreationContext } from '../core/plugins/node-plugin.contract';
export function calcPos(
  position: NodeCreationContext['position'],
  offsetX: number,
  offsetY: number,
  scroll?: NodeCreationContext['scroll'],
): { x: number; y: number } {
  return {
    x:
      position && Number.isFinite(position.x)
        ? Math.max(20, Math.round(position.x - offsetX))
        : Math.max(50, Math.round((scroll?.scrollLeft || 0) + 120 + Math.random() * 60)),
    y:
      position && Number.isFinite(position.y)
        ? Math.max(20, Math.round(position.y - offsetY))
        : Math.max(50, Math.round((scroll?.scrollTop || 0) + 80 + Math.random() * 60)),
  };
}
