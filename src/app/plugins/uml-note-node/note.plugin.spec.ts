import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { DiagramType, UmlNodeType } from '../../core/models/diagram.model';
import { notePlugin } from './note.plugin';

describe('Floating UML NotePlugin', () => {
  it('supports every diagram type and creates a note node with yellow sticky-note color', () => {
    expect(notePlugin.nodeTypes).toEqual([UmlNodeType.NOTE]);
    expect(notePlugin.defaultColor).toBe('#FEF9C3');
    const tool = notePlugin.tools[0];
    expect(tool.diagramTypes).toEqual(Object.values(DiagramType));

    const created = notePlugin.create({ nodes: [], diagramType: DiagramType.CLASS });
    expect(created.nodeType).toBe(UmlNodeType.NOTE);
    expect(created.color).toBe('#FEF9C3');
    expect(created.attributes).toEqual([]);
    expect(created.methods).toEqual([]);
    expect(notePlugin.geometry.width(created)).toBeGreaterThanOrEqual(130);
    expect(notePlugin.geometry.height(created)).toBeGreaterThanOrEqual(72);
  });
});
