import { describe, expect, it } from 'vitest';
import { computeBoardHeight, computeBoardWidth } from './node-metrics.util';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';

describe('computeBoardWidth & computeBoardHeight dynamic canvas bounds', () => {
  it('returns base defaults when diagram has few small nodes', () => {
    const nodes: UmlClassNode[] = [
      { id: 'n1', nodeType: 'class', position: { x: 100, y: 100 } } as unknown as UmlClassNode,
    ];
    expect(computeBoardWidth(nodes)).toBe(2400);
    expect(computeBoardHeight(nodes)).toBe(1600);
  });

  it('dynamically expands board dimensions when nodes are positioned far out', () => {
    const nodes: UmlClassNode[] = [
      { id: 'n1', nodeType: 'class', position: { x: 3000, y: 2500 }, width: 300, height: 200 } as unknown as UmlClassNode,
    ];
    expect(computeBoardWidth(nodes)).toBe(3800);
    expect(computeBoardHeight(nodes)).toBe(3200);
  });

  it('dynamically expands vertical board height for deep sequence diagrams based on connections and slots', () => {
    const sequenceNodes: UmlClassNode[] = [
      { id: 'life1', nodeType: 'lifeline', position: { x: 100, y: 50 } } as unknown as UmlClassNode,
      { id: 'life2', nodeType: 'lifeline', position: { x: 400, y: 50 } } as unknown as UmlClassNode,
    ];
    const connections: UmlConnection[] = [
      { id: 'c1', sourceId: 'life1_slot_0', targetId: 'life2_slot_0', type: 'sync' } as unknown as UmlConnection,
      { id: 'c2', sourceId: 'life1_slot_25', targetId: 'life2_slot_25', type: 'sync' } as unknown as UmlConnection,
    ];

    const height = computeBoardHeight(sequenceNodes, connections, DiagramType.SEQUENCE);
    expect(height).toBe(3060);
  });
});
