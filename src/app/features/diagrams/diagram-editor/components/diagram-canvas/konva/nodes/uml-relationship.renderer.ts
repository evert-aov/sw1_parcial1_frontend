import Konva from 'konva';
import { UmlNode, UmlRelationship } from '../models/uml.model';

export interface Point {
  x: number;
  y: number;
}

/**
 * Computes the exact start and end coordinates for a relationship
 * (either sequence horizontal coordinates or border intersection points)
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
  return computeBorderConnectionPoints(sourceNode, targetNode);
}

/**
 * Creates a Konva.Group for a UML 2.5 relationship.
 * @param progress Value between 0 and 1 indicating how much of the path from source to target is rendered.
 * @param flowPhase Continuous time phase (in pixels) for animated directional flow along the rendered path.
 */
export function createUmlRelationshipKonvaGroup(
  rel: UmlRelationship,
  sourceNode: UmlNode,
  targetNode: UmlNode,
  isSelected: boolean,
  progress = 1,
  flowPhase = 0
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

  // Standard Connector Geometry between two node bounding boxes
  const { start, end } = computeBorderConnectionPoints(sourceNode, targetNode);
  const fullDx = end.x - start.x;
  const fullDy = end.y - start.y;
  const angle = Math.atan2(fullDy, fullDx);
  const angleDeg = (angle * 180) / Math.PI;

  // Interpolated current tip point along the path from source to target
  const currentEnd: Point = {
    x: start.x + fullDx * clampedProgress,
    y: start.y + fullDy * clampedProgress,
  };

  const lineStroke = isSelected ? '#059669' : '#57534E';
  const isDashed = rel.type === 'dependency' || rel.type === 'trace';

  // Invisible wide hit line for easy clicking on relationships
  const hitLine = new Konva.Line({
    points: [start.x, start.y, end.x, end.y],
    stroke: 'rgba(0,0,0,0.001)',
    strokeWidth: 16,
  });
  group.add(hitLine);

  // Main connector line growing from start -> currentEnd
  const mainLine = new Konva.Line({
    points: [start.x, start.y, currentEnd.x, currentEnd.y],
    stroke: lineStroke,
    strokeWidth: isSelected ? 2.4 : 1.7,
    dash: isDashed ? [6, 5] : undefined,
    dashOffset: isDashed ? -flowPhase : 0,
    lineCap: 'round',
  });
  group.add(mainLine);

  // Subtle directional pulse overlay traveling from origin to destination
  if (clampedProgress >= 1) {
    const flowOverlay = new Konva.Line({
      points: [start.x, start.y, end.x, end.y],
      stroke: isSelected ? '#10B981' : '#059669',
      strokeWidth: 2,
      dash: [8, 28],
      dashOffset: -flowPhase,
      opacity: isSelected ? 0.85 : 0.35,
      lineCap: 'round',
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

  // Draw UML 2.5 Adornments at the current tip (or full target once >= 0.85)
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
    } else if (rel.type === 'dependency' || rel.type === 'trace') {
      const arrowLen = 12;
      const arrowSpread = 6;
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
        strokeWidth: 1.7,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: adornmentOpacity,
        listening: false,
      });
      group.add(openArrow);
    }
  }

  // Midpoint for Labels, Stereotypes & Communication/Deployment Messages (fade in smoothly as path crosses midpoint)
  const midFade = Math.max(0, Math.min(1, (clampedProgress - 0.45) / 0.4));
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const normalOffset = {
    x: -Math.sin(angle) * 14,
    y: Math.cos(angle) * 14,
  };

  if (midFade > 0) {
    // Stereotype label (e.g. «include», «trace», «HTTPS»)
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

    // Relationship Name (e.g. "crea", "miembros")
    if (rel.name) {
      const nameLabel = new Konva.Text({
        x: midX + normalOffset.x - 55,
        y: midY + normalOffset.y - 8,
        width: 110,
        text: rel.name,
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold italic',
        fill: '#2563EB',
        align: 'center',
        opacity: midFade,
        listening: false,
      });
      group.add(nameLabel);
    }

    // Stacked Messages on Communication & Deployment Links
    if (rel.messages && rel.messages.length > 0) {
      let textAngle = angleDeg;
      if (textAngle > 90 || textAngle < -90) {
        textAngle += 180;
      }

      const msgContainer = new Konva.Group({
        x: midX,
        y: midY,
        rotation: textAngle,
        opacity: midFade,
        listening: false,
      });

      const lineSpacing = 17;
      const totalCount = rel.messages.length;

      rel.messages.forEach((msg, index) => {
        const yPos = -14 - (totalCount - 1 - index) * lineSpacing;
        const dirSymbol = msg.direction === 'forward' ? '→' : '←';
        const formatted = `${msg.sequenceNumber}: ${msg.name} ${dirSymbol}`;

        const msgText = new Konva.Text({
          x: -135,
          y: yPos,
          width: 270,
          text: formatted,
          fontSize: 12,
          fontFamily: 'JetBrains Mono',
          fontStyle: 'bold',
          fill: msg.color || '#1F2937',
          align: 'center',
        });
        msgContainer.add(msgText);
      });

      group.add(msgContainer);
    }
  }

  // Source Multiplicity appears immediately near start
  if (rel.sourceMultiplicity && clampedProgress > 0.15) {
    const srcMultPos = {
      x: start.x + Math.cos(angle) * 26 - Math.sin(angle) * 14,
      y: start.y + Math.sin(angle) * 26 - Math.cos(angle) * 14,
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

  // Target Multiplicity appears as path reaches destination
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
    points: [startX, y, endX, y],
    stroke: 'rgba(0,0,0,0.001)',
    strokeWidth: 18,
  });
  group.add(hitLine);

  if (isReturn) {
    const line = new Konva.Line({
      points: [startX, y, currentEndX, y],
      stroke: color,
      strokeWidth: 1.6,
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
    });
    group.add(line, openHead);
  } else {
    const arrow = new Konva.Arrow({
      points: [startX, y, currentEndX, y],
      stroke: color,
      fill: color,
      strokeWidth: isSelected ? 2.2 : 1.6,
      pointerLength: 8,
      pointerWidth: 7,
    });
    group.add(arrow);

    // Directional flow pulse along synchronous call
    if (progress >= 1) {
      const flowPulse = new Konva.Line({
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

  // Leading tracer dot while sequence message is drawing
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
    const labelWidth = Math.max(120, Math.abs(endX - startX));
    const minX = Math.min(startX, endX);
    const label = new Konva.Text({
      x: minX,
      y: isReturn ? y + 5 : y - 16,
      width: labelWidth,
      text: rel.name || '1: call()',
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

  const start = intersectRectBorder(source, tCenter);
  const end = intersectRectBorder(target, sCenter);
  return { start, end };
}

function intersectRectBorder(rect: UmlNode, externalPoint: Point): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = externalPoint.x - cx;
  const dy = externalPoint.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const halfW = rect.width / 2 + 4;
  const halfH = rect.height / 2 + 4;

  const scaleX = halfW / Math.abs(dx || 0.0001);
  const scaleY = halfH / Math.abs(dy || 0.0001);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}
