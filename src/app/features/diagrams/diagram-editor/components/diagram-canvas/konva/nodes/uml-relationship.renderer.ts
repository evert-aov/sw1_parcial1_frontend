import Konva from 'konva';
import { UmlLineStyle, UmlNode, UmlRelationship } from '../models/uml.model';

export interface Point {
  x: number;
  y: number;
}

/**
 * Computes the exact start and end coordinates for a relationship
 * taking into account its lineStyle (e.g. Tree Vertical attaches to top/bottom edges,
 * Tree Horizontal attaches to left/right edges, etc.)
 */
export function getRelationshipEndpoints(
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode
): { start: Point; end: Point } {
  if (rel.type === 'sync_message' || rel.type === 'return_message') {
    const y = rel.yOffset || 150;
    const srcCenterX = sourceNode.x + sourceNode.width / 2;
    const tgtCenterX = targetNode.x + targetNode.width / 2;
    const goingRight = tgtCenterX >= srcCenterX;
    const startX = goingRight ? srcCenterX + 6 : srcCenterX - 6;
    const endX = goingRight ? tgtCenterX - 6 : tgtCenterX + 6;
    return {
      start: { x: startX, y },
      end: { x: endX, y },
    };
  }

  const style: UmlLineStyle = rel.lineStyle || 'direct';
  const sCx = sourceNode.x + sourceNode.width / 2;
  const sCy = sourceNode.y + sourceNode.height / 2;
  const tCx = targetNode.x + targetNode.width / 2;
  const tCy = targetNode.y + targetNode.height / 2;

  if (style === 'tree_vertical') {
    const goingDown = tCy >= sCy;
    return {
      start: {
        x: sCx,
        y: goingDown ? sourceNode.y + sourceNode.height + 2 : sourceNode.y - 2,
      },
      end: {
        x: tCx,
        y: goingDown ? targetNode.y - 2 : targetNode.y + targetNode.height + 2,
      },
    };
  }

  if (style === 'tree_horizontal') {
    const goingRight = tCx >= sCx;
    return {
      start: {
        x: goingRight ? sourceNode.x + sourceNode.width + 2 : sourceNode.x - 2,
        y: sCy,
      },
      end: {
        x: goingRight ? targetNode.x - 2 : targetNode.x + targetNode.width + 2,
        y: tCy,
      },
    };
  }

  if (style === 'lateral_vertical') {
    const goingDown = tCy >= sCy;
    const goingRight = tCx >= sCx;
    return {
      start: {
        x: sCx,
        y: goingDown ? sourceNode.y + sourceNode.height + 2 : sourceNode.y - 2,
      },
      end: {
        x: goingRight ? targetNode.x - 2 : targetNode.x + targetNode.width + 2,
        y: tCy,
      },
    };
  }

  if (style === 'lateral_horizontal') {
    const goingDown = tCy >= sCy;
    const goingRight = tCx >= sCx;
    return {
      start: {
        x: goingRight ? sourceNode.x + sourceNode.width + 2 : sourceNode.x - 2,
        y: sCy,
      },
      end: {
        x: tCx,
        y: goingDown ? targetNode.y - 2 : targetNode.y + targetNode.height + 2,
      },
    };
  }

  if (
    style === 'auto_routing' ||
    style === 'orthogonal_square' ||
    style === 'orthogonal_rounded'
  ) {
    const dx = tCx - sCx;
    const dy = tCy - sCy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const goingRight = dx >= 0;
      return {
        start: {
          x: goingRight ? sourceNode.x + sourceNode.width + 2 : sourceNode.x - 2,
          y: sCy,
        },
        end: {
          x: goingRight ? targetNode.x - 2 : targetNode.x + targetNode.width + 2,
          y: tCy,
        },
      };
    } else {
      const goingDown = dy >= 0;
      return {
        start: {
          x: sCx,
          y: goingDown ? sourceNode.y + sourceNode.height + 2 : sourceNode.y - 2,
        },
        end: {
          x: tCx,
          y: goingDown ? targetNode.y - 2 : targetNode.y + targetNode.height + 2,
        },
      };
    }
  }

  if (style === 'custom' && rel.waypoints && rel.waypoints.length > 0) {
    const firstWp = rel.waypoints[0];
    const lastWp = rel.waypoints[rel.waypoints.length - 1];
    return {
      start: intersectNodeBorder(sourceNode, firstWp),
      end: intersectNodeBorder(targetNode, lastWp),
    };
  }

  return computeBorderConnectionPoints(sourceNode, targetNode);
}

/**
 * Computes the full ordered polyline path for any of the 10 UML Line Styles
 */
export function computeRelationshipPathPoints(
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode
): Point[] {
  const { start, end } = getRelationshipEndpoints(rel, sourceNode, targetNode);
  if (rel.type === 'sync_message' || rel.type === 'return_message' || rel.type === 'assembly') {
    return [start, end];
  }

  const style: UmlLineStyle = rel.lineStyle || 'direct';

  switch (style) {
    case 'direct':
      return [start, end];

    case 'custom': {
      const wps =
        rel.waypoints && rel.waypoints.length > 0
          ? rel.waypoints
          : [{ x: Math.round((start.x + end.x) / 2), y: Math.round((start.y + end.y) / 2 - 42) }];
      return [start, ...wps, end];
    }

    case 'bezier': {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      let cp1: Point;
      let cp2: Point;
      if (Math.abs(dx) >= Math.abs(dy)) {
        cp1 = { x: start.x + dx * 0.5, y: start.y };
        cp2 = { x: start.x + dx * 0.5, y: end.y };
      } else {
        cp1 = { x: start.x, y: start.y + dy * 0.5 };
        cp2 = { x: end.x, y: start.y + dy * 0.5 };
      }
      return sampleCubicBezier(start, cp1, cp2, end, 28);
    }

    case 'tree_vertical': {
      const midY = (start.y + end.y) / 2;
      return [
        start,
        { x: start.x, y: midY },
        { x: end.x, y: midY },
        end,
      ];
    }

    case 'tree_horizontal': {
      const midX = (start.x + end.x) / 2;
      return [
        start,
        { x: midX, y: start.y },
        { x: midX, y: end.y },
        end,
      ];
    }

    case 'lateral_vertical': {
      return [
        start,
        { x: start.x, y: end.y },
        end,
      ];
    }

    case 'lateral_horizontal': {
      return [
        start,
        { x: end.x, y: start.y },
        end,
      ];
    }

    case 'auto_routing':
    case 'orthogonal_square': {
      return computeOrthogonalCorners(start, end);
    }

    case 'orthogonal_rounded': {
      const sharpCorners = computeOrthogonalCorners(start, end);
      return roundPolylineCorners(sharpCorners, 14);
    }

    default:
      return [start, end];
  }
}

/**
 * Computes the minimum Euclidean distance from a point `pt` to any segment of the relationship
 * (including its Association Class dashed stem if present).
 * Used for effortless proximity hover & click detection!
 */
export function getPointToRelationshipDistance(
  pt: Point,
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode,
  assocClassNode?: UmlNode | null
): number {
  const pathPts = computeRelationshipPathPoints(rel, sourceNode, targetNode);
  let minDist = Infinity;

  for (let i = 0; i < pathPts.length - 1; i++) {
    const d = distToSegment(pt, pathPts[i], pathPts[i + 1]);
    if (d < minDist) minDist = d;
  }

  // Also check distance to the Association Class dashed stem if present
  if (assocClassNode && pathPts.length >= 2) {
    const { midpoint } = slicePolylineByProgress(pathPts, 1);
    const stemEnd = intersectNodeBorder(assocClassNode, midpoint);
    const dStem = distToSegment(pt, midpoint, stemEnd);
    if (dStem < minDist) minDist = dStem;
  }

  return minDist;
}

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

function computeOrthogonalCorners(start: Point, end: Point): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return [start, end];
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = (start.x + end.x) / 2;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  } else {
    const midY = (start.y + end.y) / 2;
    return [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ];
  }
}

function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    pts.push({
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    });
  }
  return pts;
}

function roundPolylineCorners(points: Point[], radius: number): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 4 || len2 < 4) {
      result.push(curr);
      continue;
    }

    const r = Math.min(radius, len1 * 0.45, len2 * 0.45);
    const startArc: Point = {
      x: curr.x + (v1x / len1) * r,
      y: curr.y + (v1y / len1) * r,
    };
    const endArc: Point = {
      x: curr.x + (v2x / len2) * r,
      y: curr.y + (v2y / len2) * r,
    };

    const arcSteps = 6;
    for (let s = 0; s <= arcSteps; s++) {
      const t = s / arcSteps;
      const u = 1 - t;
      result.push({
        x: u * u * startArc.x + 2 * u * t * curr.x + t * t * endArc.x,
        y: u * u * startArc.y + 2 * u * t * curr.y + t * t * endArc.y,
      });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function slicePolylineByProgress(
  points: Point[],
  progress: number
): {
  flatPoints: number[];
  tip: Point;
  tipAngle: number;
  midpoint: Point;
  midAngle: number;
} {
  if (points.length < 2) {
    const p = points[0] || { x: 0, y: 0 };
    return { flatPoints: [p.x, p.y], tip: p, tipAngle: 0, midpoint: p, midAngle: 0 };
  }

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(d);
    totalLen += d;
  }

  if (totalLen < 0.001) {
    return {
      flatPoints: [points[0].x, points[0].y, points[1].x, points[1].y],
      tip: points[points.length - 1],
      tipAngle: 0,
      midpoint: points[0],
      midAngle: 0,
    };
  }

  const halfLen = totalLen * 0.5;
  let accumMid = 0;
  let midpoint: Point = points[0];
  let midAngle = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumMid + segLen >= halfLen || i === segLengths.length - 1) {
      const localT = segLen > 0 ? (halfLen - accumMid) / segLen : 0;
      midpoint = {
        x: points[i].x + (points[i + 1].x - points[i].x) * localT,
        y: points[i].y + (points[i + 1].y - points[i].y) * localT,
      };
      midAngle = Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x);
      break;
    }
    accumMid += segLen;
  }

  const targetLen = totalLen * Math.max(0, Math.min(1, progress));
  const flatPoints: number[] = [points[0].x, points[0].y];
  let accum = 0;
  let tip: Point = points[0];
  let tipAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    const pA = points[i];
    const pB = points[i + 1];
    if (segLen > 0.001) {
      tipAngle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
    }

    if (accum + segLen <= targetLen) {
      flatPoints.push(pB.x, pB.y);
      tip = pB;
      accum += segLen;
    } else {
      const remain = targetLen - accum;
      const t = segLen > 0 ? remain / segLen : 0;
      tip = {
        x: pA.x + (pB.x - pA.x) * t,
        y: pA.y + (pB.y - pA.y) * t,
      };
      flatPoints.push(tip.x, tip.y);
      break;
    }
  }

  return { flatPoints, tip, tipAngle, midpoint, midAngle };
}

/**
 * Creates a Konva.Group for a UML 2.5 relationship supporting all 10 Line Styles,
 * wide invisible magnetic hit-corridors, hover halos, and UML 2.5 Association Class dashed stems!
 */
export function createUmlRelationshipKonvaGroup(
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode,
  isSelected: boolean,
  progress = 1,
  flowPhase = 0,
  assocClassNode?: UmlNode | null
): Konva.Group {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const group = new Konva.Group({
    id: rel.id,
    name: 'uml-relationship',
  });

  // Sequence Diagram Messages (Horizontal between lifelines at yOffset)
  if (rel.type === 'sync_message' || rel.type === 'return_message') {
    drawSequenceMessage(group, rel, sourceNode, targetNode, isSelected, clampedProgress, flowPhase);
    return group;
  }

  // Component Diagram Assembly Connector (Interfaz Requerida ──(◯── Interfaz Provista)
  if (rel.type === 'assembly') {
    drawAssemblyConnector(group, rel, sourceNode, targetNode, isSelected, clampedProgress, flowPhase);
    return group;
  }

  // Compute polyline path according to the relationship's Line Style
  const fullPathPoints = computeRelationshipPathPoints(rel, sourceNode, targetNode);
  const fullFlatPoints = fullPathPoints.flatMap((p) => [p.x, p.y]);
  const start = fullPathPoints[0];
  const end = fullPathPoints[fullPathPoints.length - 1];

  const {
    flatPoints: animatedFlatPoints,
    tip: currentEnd,
    tipAngle: angle,
    midpoint,
    midAngle,
  } = slicePolylineByProgress(fullPathPoints, clampedProgress);

  const angleDeg = (midAngle * 180) / Math.PI;
  const startAngle =
    fullPathPoints.length > 1
      ? Math.atan2(fullPathPoints[1].y - start.y, fullPathPoints[1].x - start.x)
      : angle;

  const lineStroke = isSelected ? '#059669' : rel.type === 'note_anchor' ? '#78716C' : '#292524';
  const isDashed =
    rel.type === 'dependency' || rel.type === 'trace' || rel.type === 'note_anchor';

  // 1. ULTRA-WIDE INVISIBLE MAGNETIC HIT CORRIDOR (44px wide!) surrounding the entire line
  const hitCorridor = new Konva.Line({
    name: 'hit-corridor',
    points: fullFlatPoints,
    stroke: 'rgba(16, 185, 129, 0.005)',
    strokeWidth: 38,
    hitStrokeWidth: 46,
    lineCap: 'round',
    lineJoin: 'round',
  });
  group.add(hitCorridor);

  // 2. HOVER HALO (Lights up softly when the user moves the cursor near the line so they know it's clickable!)
  const hoverHalo = new Konva.Line({
    name: 'hover-halo',
    points: fullFlatPoints,
    stroke: 'rgba(16, 185, 129, 0.22)',
    strokeWidth: 14,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: isSelected ? 1 : 0,
    listening: false,
  });
  group.add(hoverHalo);

  // 3. Main connector polyline growing progressively from start -> currentEnd
  const mainLine = new Konva.Line({
    points: animatedFlatPoints,
    stroke: lineStroke,
    strokeWidth: isSelected ? 2.5 : 1.65,
    hitStrokeWidth: 42,
    dash: rel.type === 'note_anchor' ? [4, 4] : isDashed ? [6, 5] : undefined,
    dashOffset: isDashed ? -flowPhase : 0,
    name: isDashed ? 'flow-pulse' : 'main-line',
    lineCap: 'round',
    lineJoin: rel.lineStyle === 'orthogonal_square' ? 'miter' : 'round',
  });
  group.add(mainLine);

  // 4. UML 2.5 ASSOCIATION CLASS DASHED STEM (From the midpoint of the Association Line to the Association Class!)
  if (assocClassNode && clampedProgress > 0.45) {
    const stemProgress = Math.max(0, Math.min(1, (clampedProgress - 0.45) / 0.55));
    const stemTarget = intersectNodeBorder(assocClassNode, midpoint);
    const curStemEnd: Point = {
      x: midpoint.x + (stemTarget.x - midpoint.x) * stemProgress,
      y: midpoint.y + (stemTarget.y - midpoint.y) * stemProgress,
    };

    // Wide invisible hit corridor on the Association Class dashed stem too
    const stemHitCorridor = new Konva.Line({
      points: [midpoint.x, midpoint.y, stemTarget.x, stemTarget.y],
      stroke: 'rgba(16, 185, 129, 0.005)',
      strokeWidth: 36,
      hitStrokeWidth: 44,
      lineCap: 'round',
    });

    const stemHoverHalo = new Konva.Line({
      name: 'hover-halo',
      points: [midpoint.x, midpoint.y, curStemEnd.x, curStemEnd.y],
      stroke: 'rgba(16, 185, 129, 0.22)',
      strokeWidth: 12,
      lineCap: 'round',
      opacity: isSelected ? 1 : 0,
      listening: false,
    });

    const dashedStem = new Konva.Line({
      name: 'flow-pulse',
      points: [midpoint.x, midpoint.y, curStemEnd.x, curStemEnd.y],
      stroke: isSelected ? '#059669' : '#292524',
      strokeWidth: isSelected ? 2.2 : 1.5,
      hitStrokeWidth: 38,
      dash: [6, 5],
      dashOffset: -flowPhase,
      lineCap: 'round',
    });

    // Small connection anchor dot on the midpoint where the Association Class stem branches off
    const midpointDot = new Konva.Circle({
      x: midpoint.x,
      y: midpoint.y,
      radius: 3.5,
      fill: isSelected ? '#059669' : '#292524',
      listening: false,
    });

    group.add(stemHitCorridor, stemHoverHalo, dashedStem, midpointDot);
  }

  // 5. Interactive Midpoint Hover Target Ring (Makes clicking the center of any line even more obvious on hover)
  if (clampedProgress >= 1) {
    const midHandle = new Konva.Circle({
      name: 'hover-halo',
      x: midpoint.x,
      y: midpoint.y,
      radius: 5,
      fill: '#FFFFFF',
      stroke: '#059669',
      strokeWidth: 2,
      opacity: isSelected ? 1 : 0,
      listening: false,
    });
    group.add(midHandle);
  }

  // Selected relationship endpoint squares for clear visual feedback
  if (isSelected && clampedProgress >= 1) {
    group.add(
      new Konva.Rect({
        x: start.x - 4,
        y: start.y - 4,
        width: 8,
        height: 8,
        fill: '#FFFFFF',
        stroke: '#292524',
        strokeWidth: 1.5,
        listening: false,
      }),
      new Konva.Rect({
        x: end.x - 4,
        y: end.y - 4,
        width: 8,
        height: 8,
        fill: '#FFFFFF',
        stroke: '#292524',
        strokeWidth: 1.5,
        listening: false,
      })
    );
  }

  // Subtle directional pulse overlay traveling from origin to destination along the path
  if (clampedProgress >= 1) {
    const flowOverlay = new Konva.Line({
      name: 'flow-pulse',
      points: fullFlatPoints,
      stroke: isSelected ? '#10B981' : '#059669',
      strokeWidth: 2,
      dash: [8, 28],
      dashOffset: -flowPhase,
      opacity: isSelected ? 0.85 : 0.35,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    });
    group.add(flowOverlay);
  }

  // Glowing leading tracer head while the path is actively drawing from source to target
  if (clampedProgress > 0.01 && clampedProgress < 0.99) {
    const tracerHead = new Konva.Circle({
      x: currentEnd.x,
      y: currentEnd.y,
      radius: 4.5,
      fill: '#10B981',
      shadowColor: '#10B981',
      shadowBlur: 10,
      shadowOpacity: 0.9,
      listening: false,
    });
    group.add(tracerHead);
  }

  // Draw UML 2.5 Adornments at the current tip oriented along the final segment tangent angle
  const adornmentOpacity = Math.max(0, Math.min(1, (clampedProgress - 0.7) / 0.3));
  if (adornmentOpacity > 0) {
    if (rel.type === 'composition' || rel.type === 'aggregation') {
      const diamondLen = 15;
      const diamondHalfW = 6;
      const p1 = currentEnd;
      const p2 = {
        x: currentEnd.x - diamondLen * 0.5 * Math.cos(angle) + diamondHalfW * Math.sin(angle),
        y: currentEnd.y - diamondLen * 0.5 * Math.sin(angle) - diamondHalfW * Math.cos(angle),
      };
      const p3 = {
        x: currentEnd.x - diamondLen * Math.cos(angle),
        y: currentEnd.y - diamondLen * Math.sin(angle),
      };
      const p4 = {
        x: currentEnd.x - diamondLen * 0.5 * Math.cos(angle) - diamondHalfW * Math.sin(angle),
        y: currentEnd.y - diamondLen * 0.5 * Math.sin(angle) + diamondHalfW * Math.cos(angle),
      };

      const diamond = new Konva.Line({
        points: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y],
        closed: true,
        fill: rel.type === 'composition' ? '#3E3832' : '#FFFFFF',
        stroke: lineStroke,
        strokeWidth: 1.7,
        opacity: adornmentOpacity,
        listening: false,
      });
      group.add(diamond);
    } else if (rel.type === 'generalization') {
      const triLen = 14;
      const triHalfW = 7;
      const baseCenter = {
        x: currentEnd.x - triLen * Math.cos(angle),
        y: currentEnd.y - triLen * Math.sin(angle),
      };
      const leftCorner = {
        x: baseCenter.x + triHalfW * Math.sin(angle),
        y: baseCenter.y - triHalfW * Math.cos(angle),
      };
      const rightCorner = {
        x: baseCenter.x - triHalfW * Math.sin(angle),
        y: baseCenter.y + triHalfW * Math.cos(angle),
      };

      const triangle = new Konva.Line({
        points: [
          currentEnd.x,
          currentEnd.y,
          leftCorner.x,
          leftCorner.y,
          rightCorner.x,
          rightCorner.y,
        ],
        closed: true,
        fill: '#FFFFFF',
        stroke: lineStroke,
        strokeWidth: 1.7,
        opacity: adornmentOpacity,
        listening: false,
      });
      group.add(triangle);
    } else if (
      rel.type === 'dependency' ||
      rel.type === 'trace' ||
      rel.type === 'control_flow'
    ) {
      const arrowLen = 12;
      const arrowSpread = 5.5;
      const wing1 = {
        x: currentEnd.x - arrowLen * Math.cos(angle) + arrowSpread * Math.sin(angle),
        y: currentEnd.y - arrowLen * Math.sin(angle) - arrowSpread * Math.cos(angle),
      };
      const wing2 = {
        x: currentEnd.x - arrowLen * Math.cos(angle) - arrowSpread * Math.sin(angle),
        y: currentEnd.y - arrowLen * Math.sin(angle) + arrowSpread * Math.cos(angle),
      };

      const openArrow = new Konva.Line({
        points: [wing1.x, wing1.y, currentEnd.x, currentEnd.y, wing2.x, wing2.y],
        stroke: lineStroke,
        strokeWidth: isSelected ? 2 : 1.55,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: adornmentOpacity,
        listening: false,
      });
      group.add(openArrow);
    }
  }

  // Midpoint along the polyline for Labels, Stereotypes & Communication/Deployment Messages
  const midFade = Math.max(0, Math.min(1, (clampedProgress - 0.45) / 0.4));
  const midX = midpoint.x;
  const midY = midpoint.y;
  const normalOffset = {
    x: -Math.sin(midAngle) * 14,
    y: Math.cos(midAngle) * 14,
  };

  if (midFade > 0) {
    if (rel.stereotype) {
      const stereoLabel = new Konva.Text({
        x: midX - 65,
        y: midY + 6,
        width: 130,
        text: rel.stereotype.startsWith('«') ? rel.stereotype : `«${rel.stereotype}»`,
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold italic',
        fill: '#2563EB',
        align: 'center',
        opacity: midFade,
        listening: false,
      });
      group.add(stereoLabel);
    }

    if (rel.name) {
      const isGuard = rel.name.trim().startsWith('[');
      const labelWidth = Math.max(130, rel.name.length * 7.8 + 20);
      const nameLabel = new Konva.Text({
        x: midX + normalOffset.x - labelWidth / 2,
        y: midY + normalOffset.y - 8,
        width: labelWidth,
        text: rel.name,
        fontSize: 11.5,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: isGuard ? 'normal' : 'bold italic',
        fill: isGuard ? '#57534E' : '#2563EB',
        align: 'center',
        opacity: midFade,
        listening: false,
      });
      group.add(nameLabel);
    }

    // Stacked Messages on Communication & Deployment Links
    if (rel.messages && rel.messages.length > 0) {
      let textAngle = angleDeg;
      let flipped = false;
      if (textAngle > 90 || textAngle < -90) {
        textAngle += 180;
        flipped = true;
      }

      const msgContainer = new Konva.Group({
        x: midX,
        y: midY,
        rotation: textAngle,
        opacity: midFade,
        listening: false,
      });

      const lineSpacing = 17;
      const forwardMsgs = rel.messages.filter((m) => m.direction === 'forward');
      const backwardMsgs = rel.messages.filter((m) => m.direction === 'backward');

      forwardMsgs.forEach((msg, index) => {
        const yPos = -18 - (forwardMsgs.length - 1 - index) * lineSpacing;
        const arrowChar = flipped ? '←' : '→';
        const formatted = `${msg.sequenceNumber}: ${msg.name} ${arrowChar}`;
        const dynamicW = Math.max(280, formatted.length * 7.8 + 24);

        const msgText = new Konva.Text({
          x: -dynamicW / 2,
          y: yPos,
          width: dynamicW,
          text: formatted,
          fontSize: 12,
          fontFamily: 'JetBrains Mono',
          fontStyle: 'bold',
          fill: msg.color || '#1F2937',
          align: 'center',
        });
        msgContainer.add(msgText);
      });

      backwardMsgs.forEach((msg, index) => {
        const yPos = 8 + index * lineSpacing;
        const arrowChar = flipped ? '→' : '←';
        const formatted = `${msg.sequenceNumber}: ${msg.name} ${arrowChar}`;
        const dynamicW = Math.max(280, formatted.length * 7.8 + 24);

        const msgText = new Konva.Text({
          x: -dynamicW / 2,
          y: yPos,
          width: dynamicW,
          text: formatted,
          fontSize: 12,
          fontFamily: 'JetBrains Mono',
          fontStyle: 'bold',
          fill: msg.color || '#991B1B',
          align: 'center',
        });
        msgContainer.add(msgText);
      });

      group.add(msgContainer);
    }
  }

  if (rel.sourceMultiplicity && clampedProgress > 0.15) {
    const srcMultPos = {
      x: start.x + Math.cos(startAngle) * 26 - Math.sin(startAngle) * 14,
      y: start.y + Math.sin(startAngle) * 26 - Math.cos(startAngle) * 14,
    };
    group.add(
      new Konva.Text({
        x: srcMultPos.x - 16,
        y: srcMultPos.y - 8,
        text: rel.sourceMultiplicity,
        fontSize: 12,
        fontFamily: 'JetBrains Mono',
        fontStyle: 'bold',
        fill: '#1C1917',
        listening: false,
      })
    );
  }

  if (rel.targetMultiplicity && adornmentOpacity > 0) {
    const tgtMultPos = {
      x: end.x - Math.cos(angle) * 32 - Math.sin(angle) * 14,
      y: end.y - Math.sin(angle) * 32 - Math.cos(angle) * 14,
    };
    group.add(
      new Konva.Text({
        x: tgtMultPos.x - 16,
        y: tgtMultPos.y - 8,
        text: rel.targetMultiplicity,
        fontSize: 12,
        fontFamily: 'JetBrains Mono',
        fontStyle: 'bold',
        fill: '#1C1917',
        opacity: adornmentOpacity,
        listening: false,
      })
    );
  }

  return group;
}

/**
 * Draws the UML 2.5 Assembly Connector (Ball-and-Socket / Lollipop + Semicircle)
 */
function drawAssemblyConnector(
  group: Konva.Group,
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode,
  isSelected: boolean,
  progress: number,
  flowPhase: number
): void {
  const { start, end } = computeBorderConnectionPoints(sourceNode, targetNode);
  const fullDx = end.x - start.x;
  const fullDy = end.y - start.y;
  const angleRad = Math.atan2(fullDy, fullDx);
  const angleDeg = (angleRad * 180) / Math.PI;

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const lineStroke = isSelected ? '#059669' : '#3F3A34';

  group.add(
    new Konva.Line({
      name: 'hit-corridor',
      points: [start.x, start.y, end.x, end.y],
      stroke: 'rgba(16, 185, 129, 0.005)',
      strokeWidth: 38,
      hitStrokeWidth: 46,
    }),
    new Konva.Line({
      name: 'hover-halo',
      points: [start.x, start.y, end.x, end.y],
      stroke: 'rgba(16, 185, 129, 0.22)',
      strokeWidth: 14,
      lineCap: 'round',
      opacity: isSelected ? 1 : 0,
      listening: false,
    })
  );

  const socketRadius = 9.5;
  const ballRadius = 6;

  const socketRimPoint: Point = {
    x: midX - Math.cos(angleRad) * socketRadius,
    y: midY - Math.sin(angleRad) * socketRadius,
  };

  const ballRimPoint: Point = {
    x: midX + Math.cos(angleRad) * ballRadius,
    y: midY + Math.sin(angleRad) * ballRadius,
  };

  const p1 = Math.min(1, progress * 2);
  const curMid1: Point = {
    x: start.x + (socketRimPoint.x - start.x) * p1,
    y: start.y + (socketRimPoint.y - start.y) * p1,
  };

  group.add(
    new Konva.Line({
      points: [start.x, start.y, curMid1.x, curMid1.y],
      stroke: lineStroke,
      strokeWidth: isSelected ? 2.2 : 1.45,
      hitStrokeWidth: 38,
      lineCap: 'round',
    })
  );

  if (progress >= 0.45) {
    const symbolOpacity = Math.min(1, (progress - 0.45) / 0.2);

    const socketArc = new Konva.Arc({
      x: midX,
      y: midY,
      innerRadius: socketRadius,
      outerRadius: socketRadius,
      angle: 180,
      rotation: angleDeg + 90,
      stroke: lineStroke,
      strokeWidth: isSelected ? 2 : 1.45,
      opacity: symbolOpacity,
      listening: false,
    });

    const lollipopBall = new Konva.Circle({
      x: midX,
      y: midY,
      radius: ballRadius,
      fill: '#F5EFE8',
      stroke: lineStroke,
      strokeWidth: isSelected ? 2 : 1.45,
      opacity: symbolOpacity,
      listening: false,
    });

    group.add(socketArc, lollipopBall);
  }

  if (progress > 0.5) {
    const p2 = Math.min(1, (progress - 0.5) * 2);
    const curEnd2: Point = {
      x: ballRimPoint.x + (end.x - ballRimPoint.x) * p2,
      y: ballRimPoint.y + (end.y - ballRimPoint.y) * p2,
    };

    group.add(
      new Konva.Line({
        points: [ballRimPoint.x, ballRimPoint.y, curEnd2.x, curEnd2.y],
        stroke: lineStroke,
        strokeWidth: isSelected ? 2.2 : 1.45,
        hitStrokeWidth: 38,
        lineCap: 'round',
      })
    );
  }

  if (progress >= 1) {
    const flowLine = new Konva.Line({
      name: 'flow-pulse',
      points: [start.x, start.y, end.x, end.y],
      stroke: isSelected ? '#10B981' : '#059669',
      strokeWidth: 2,
      dash: [7, 28],
      dashOffset: -flowPhase,
      opacity: isSelected ? 0.8 : 0.35,
      listening: false,
    });
    group.add(flowLine);
  }

  if (rel.name && progress > 0.6) {
    group.add(
      new Konva.Text({
        x: midX + 12,
        y: midY - 8,
        text: rel.name,
        fontSize: 11,
        fontFamily: 'JetBrains Mono',
        fontStyle: 'bold',
        fill: '#475569',
        listening: false,
      })
    );
  }
}

function drawSequenceMessage(
  group: Konva.Group,
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode,
  isSelected: boolean,
  progress: number,
  flowPhase: number
): void {
  const y = rel.yOffset || 150;
  const srcCenterX = sourceNode.x + sourceNode.width / 2;
  const tgtCenterX = targetNode.x + targetNode.width / 2;
  const goingRight = tgtCenterX >= srcCenterX;

  const startX = goingRight ? srcCenterX + 6 : srcCenterX - 6;
  const endX = goingRight ? tgtCenterX - 6 : tgtCenterX + 6;
  const currentEndX = startX + (endX - startX) * progress;

  const color = isSelected ? '#059669' : rel.messageColor || '#292524';
  const isReturn = rel.type === 'return_message';

  const hitLine = new Konva.Line({
    name: 'hit-corridor',
    points: [startX, y, endX, y],
    stroke: 'rgba(16, 185, 129, 0.005)',
    strokeWidth: 38,
    hitStrokeWidth: 46,
  });
  const hoverHalo = new Konva.Line({
    name: 'hover-halo',
    points: [startX, y, currentEndX, y],
    stroke: 'rgba(16, 185, 129, 0.22)',
    strokeWidth: 12,
    lineCap: 'round',
    opacity: isSelected ? 1 : 0,
    listening: false,
  });
  group.add(hitLine, hoverHalo);

  if (isReturn) {
    const line = new Konva.Line({
      name: 'flow-pulse',
      points: [startX, y, currentEndX, y],
      stroke: color,
      strokeWidth: 1.6,
      hitStrokeWidth: 38,
      dash: [5, 4],
      dashOffset: -flowPhase,
    });
    const dir = goingRight ? -1 : 1;
    const openHead = new Konva.Line({
      points: [currentEndX + dir * 9, y - 4.5, currentEndX, y, currentEndX + dir * 9, y + 4.5],
      stroke: color,
      strokeWidth: 1.6,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: progress > 0.15 ? 1 : 0,
      listening: false,
    });
    group.add(line, openHead);
  } else {
    const arrow = new Konva.Arrow({
      points: [startX, y, currentEndX, y],
      stroke: color,
      fill: color,
      strokeWidth: isSelected ? 2.2 : 1.6,
      hitStrokeWidth: 38,
      pointerLength: 8,
      pointerWidth: 7,
    });
    group.add(arrow);

    if (progress >= 1) {
      const flowPulse = new Konva.Line({
        name: 'flow-pulse',
        points: [startX, y, endX, y],
        stroke: '#10B981',
        strokeWidth: 2,
        dash: [6, 26],
        dashOffset: -flowPhase,
        opacity: 0.45,
        listening: false,
      });
      group.add(flowPulse);
    }
  }

  if (progress > 0.01 && progress < 0.99) {
    group.add(
      new Konva.Circle({
        x: currentEndX,
        y,
        radius: 4,
        fill: '#10B981',
        shadowColor: '#10B981',
        shadowBlur: 8,
        listening: false,
      })
    );
  }

  const labelFade = Math.max(0, Math.min(1, (progress - 0.35) / 0.45));
  if (labelFade > 0) {
    const msgText = rel.name || '1: call()';
    const spanWidth = Math.abs(endX - startX);
    const requiredTextW = msgText.length * 7.5 + 24;
    const labelWidth = Math.max(spanWidth, requiredTextW);
    const centerSpanX = (startX + endX) / 2;

    const label = new Konva.Text({
      x: centerSpanX - labelWidth / 2,
      y: isReturn ? y + 6 : y - 17,
      width: labelWidth,
      text: msgText,
      fontSize: 11.5,
      fontFamily: 'JetBrains Mono',
      fontStyle: 'bold',
      fill: color,
      align: 'center',
      opacity: labelFade,
      listening: false,
    });
    group.add(label);
  }
}

function computeBorderConnectionPoints(source: UmlNode, target: UmlNode): { start: Point; end: Point } {
  const sCenter: Point = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const tCenter: Point = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };

  const start = intersectNodeBorder(source, tCenter);
  const end = intersectNodeBorder(target, sCenter);
  return { start, end };
}

function intersectNodeBorder(node: UmlNode, externalPoint: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = externalPoint.x - cx;
  const dy = externalPoint.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  if (node.type === 'activity_fork') {
    const clampedX = Math.max(node.x + 18, Math.min(node.x + node.width - 18, externalPoint.x));
    const barHalfH = 5;
    return {
      x: clampedX,
      y: dy >= 0 ? cy + barHalfH : cy - barHalfH,
    };
  }

  const halfW = node.width / 2 + 3;
  const halfH = node.height / 2 + 3;

  const scaleX = halfW / Math.abs(dx || 0.0001);
  const scaleY = halfH / Math.abs(dy || 0.0001);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}
