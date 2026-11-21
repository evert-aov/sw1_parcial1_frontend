import { describe, expect, it } from 'vitest';
import { EFConnectableSide } from '@foblex/flow';
import {
  CalculateSequenceLineData,
  CalculateSequenceSelfLineData,
  SEQUENCE_SELF_BOTTOM_OFFSET,
  SEQUENCE_SELF_LOOP_WIDTH,
  SEQUENCE_SELF_TOP_OFFSET,
} from './sequence-connection.builder';

describe('Sequence connection builders', () => {
  const baseRequest = (
    source: { x: number; y: number },
    target: { x: number; y: number },
    sourceSide = EFConnectableSide.RIGHT,
    targetSide = EFConnectableSide.LEFT,
  ) => ({
    source,
    target,
    sourceSide,
    targetSide,
    radius: 0,
    offset: 0,
    waypoints: [],
  });

  describe('CalculateSequenceLineData', () => {
    const builder = new CalculateSequenceLineData();

    it('connects left-to-right activation edge points directly without extra gap', () => {
      const result = builder.handle(baseRequest({ x: 107, y: 200 }, { x: 293, y: 200 }));

      expect(result.points).toEqual([
        { x: 107, y: 200 },
        { x: 293, y: 200 },
      ]);
      expect(result.path).toBe('M 107 200 L 293 200');
    });

    it('connects right-to-left reply activation edge points directly without crossing bars', () => {
      const result = builder.handle(
        baseRequest({ x: 293, y: 250 }, { x: 107, y: 250 }, EFConnectableSide.LEFT, EFConnectableSide.RIGHT),
      );

      expect(result.points).toEqual([
        { x: 293, y: 250 },
        { x: 107, y: 250 },
      ]);
      expect(result.path).toBe('M 293 250 L 107 250');
    });
  });

  describe('CalculateSequenceSelfLineData', () => {
    const builder = new CalculateSequenceSelfLineData();

    it('routes a rectangular self-message loop starting and ending on the right activation edge', () => {
      const result = builder.handle(
        baseRequest({ x: 207, y: 300 }, { x: 207, y: 300 }, EFConnectableSide.RIGHT, EFConnectableSide.RIGHT),
      );
      const edgeX = 207;
      const outerX = edgeX + SEQUENCE_SELF_LOOP_WIDTH;
      const topY = 300 + SEQUENCE_SELF_TOP_OFFSET;
      const bottomY = 300 + SEQUENCE_SELF_BOTTOM_OFFSET;

      expect(result.points).toEqual([
        { x: edgeX, y: topY },
        { x: outerX, y: topY },
        { x: outerX, y: bottomY },
        { x: edgeX, y: bottomY },
      ]);
      expect(result.penultimatePoint).toEqual({ x: outerX, y: bottomY });
      expect(result.path).toBe(
        `M ${edgeX} ${topY} L ${outerX} ${topY} L ${outerX} ${bottomY} L ${edgeX} ${bottomY}`,
      );
    });
  });
});
