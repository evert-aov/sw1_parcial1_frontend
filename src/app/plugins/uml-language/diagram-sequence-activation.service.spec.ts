import { describe, expect, it } from 'vitest';
import { DiagramSequenceActivationService } from './diagram-sequence-activation.service';
import { UmlClassNode, UmlConnection } from '../../core/models/diagram.model';

describe('DiagramSequenceActivationService dynamic sequence slots & lifeline length', () => {
  const service = new DiagramSequenceActivationService();

  it('provides minimal initial slot count and lifeline length for an empty sequence diagram', () => {
    const slots = service.getSequenceSlots([]);
    expect(slots.length).toBe(1);
    expect(slots[0]).toBe(0);

    const length = service.getLifelineLength(
      { id: 'life1', nodeType: 'lifeline', position: { x: 100, y: 50 }, name: 'Order' } as unknown as UmlClassNode,
      [],
    );
    expect(length).toBe(120);

    const actorLength = service.getLifelineLength(
      { id: 'actor1', nodeType: 'actor', position: { x: 50, y: 50 }, name: 'User' } as unknown as UmlClassNode,
      [],
    );
    expect(actorLength).toBe(80);
  });

  it('dynamically ends exactly 20px below the last message', () => {
    const conns: UmlConnection[] = [
      { id: 'c1', sourceId: 'a_slot_0', targetId: 'b_slot_0', type: 'sync' } as unknown as UmlConnection,
      { id: 'c2', sourceId: 'a_slot_5', targetId: 'b_slot_5', type: 'sync' } as unknown as UmlConnection,
    ];

    const slotCount = service.getSequenceSlotCount(conns);
    expect(slotCount).toBe(7); // slots 0..5 used, slot 6 available

    const slots = service.getSequenceSlots(conns);
    expect(slots.length).toBe(7);
    expect(slots[6]).toBe(6);

    const length = service.getLifelineLength(
      { id: 'life1', nodeType: 'lifeline', position: { x: 100, y: 50 }, name: 'Order' } as unknown as UmlClassNode,
      conns,
    );
    // targetBottom = 210 + 5 * 50 + 20 = 480; 480 - 60 = 420; slot 5 Y = 400; protrusion = 20px
    expect(length).toBe(420);

    const actorLength = service.getLifelineLength(
      { id: 'actor1', nodeType: 'actor', position: { x: 50, y: 50 }, name: 'User' } as unknown as UmlClassNode,
      conns,
    );
    // targetBottom = 480; 480 - 65 = 415; slot 5 Y = 395; protrusion = 20px
    expect(actorLength).toBe(415);
  });

  it('handles deeper sequence diagrams and preserves 20px protrusion', () => {
    const conns: UmlConnection[] = [
      { id: 'c1', sourceId: 'a_slot_45', targetId: 'b_slot_45', type: 'sync' } as unknown as UmlConnection,
    ];

    const slotCount = service.getSequenceSlotCount(conns);
    expect(slotCount).toBe(47);

    const length = service.getLifelineLength(
      { id: 'actor1', nodeType: 'actor', position: { x: 50, y: 50 }, name: 'User' } as unknown as UmlClassNode,
      conns,
    );
    // targetBottom = 210 + 45 * 50 + 20 = 2480; 2480 - 65 = 2415
    expect(length).toBe(2415);
  });

  it('correctly calculates activation bars aligned with messages and replies (like in the system diagrams)', () => {
    const userNode = { id: 'usr', nodeType: 'actor', position: { x: 50, y: 50 } } as unknown as UmlClassNode;
    const authViewNode = { id: 'ui', nodeType: 'lifeline', position: { x: 200, y: 50 } } as unknown as UmlClassNode;
    const ctrlNode = { id: 'ctrl', nodeType: 'lifeline', position: { x: 400, y: 50 } } as unknown as UmlClassNode;
    const repoNode = { id: 'repo', nodeType: 'lifeline', position: { x: 600, y: 50 } } as unknown as UmlClassNode;

    // Interaction 1: Register flow
    // 0: usr -> ui (1: submitRegister)
    // 1: ui -> ctrl (1.1: register)
    // 2: ctrl -> repo (1.2: existsByEmail)
    // 3: repo -> ctrl (1.3: userExists : Boolean) [reply]
    // 4: ctrl -> repo (1.4: createUser)
    // 5: repo -> ctrl (1.5: userCreated) [reply]
    // 6: ui -> usr (1.6: showSuccessMessage) [reply]
    // Interaction 2: Login flow
    // 7: usr -> ui (2: submitLogin)
    // 8: ui -> ctrl (2.1: authenticate)
    // 9: ctrl -> repo (2.2: findByEmail)
    // 10: repo -> ctrl (2.3: returnUser) [reply]
    // 11: ui -> usr (2.4: authSuccess) [reply]
    const conns: UmlConnection[] = [
      { id: 'c1', sourceId: 'usr_slot_0', targetId: 'ui_slot_0', type: 'sync', name: '1: submitRegister' } as unknown as UmlConnection,
      { id: 'c2', sourceId: 'ui_slot_1', targetId: 'ctrl_slot_1', type: 'sync', name: '1.1: register' } as unknown as UmlConnection,
      { id: 'c3', sourceId: 'ctrl_slot_2', targetId: 'repo_slot_2', type: 'sync', name: '1.2: existsByEmail' } as unknown as UmlConnection,
      { id: 'c4', sourceId: 'repo_slot_3', targetId: 'ctrl_slot_3', type: 'reply', name: '1.3: userExists' } as unknown as UmlConnection,
      { id: 'c5', sourceId: 'ctrl_slot_4', targetId: 'repo_slot_4', type: 'sync', name: '1.4: createUser' } as unknown as UmlConnection,
      { id: 'c6', sourceId: 'repo_slot_5', targetId: 'ctrl_slot_5', type: 'reply', name: '1.5: userCreated' } as unknown as UmlConnection,
      { id: 'c7', sourceId: 'ui_slot_6', targetId: 'usr_slot_6', type: 'reply', name: '1.6: showSuccessMessage' } as unknown as UmlConnection,

      { id: 'c8', sourceId: 'usr_slot_7', targetId: 'ui_slot_7', type: 'sync', name: '2: submitLogin' } as unknown as UmlConnection,
      { id: 'c9', sourceId: 'ui_slot_8', targetId: 'ctrl_slot_8', type: 'sync', name: '2.1: authenticate' } as unknown as UmlConnection,
      { id: 'c10', sourceId: 'ctrl_slot_9', targetId: 'repo_slot_9', type: 'sync', name: '2.2: findByEmail' } as unknown as UmlConnection,
      { id: 'c11', sourceId: 'repo_slot_10', targetId: 'ctrl_slot_10', type: 'reply', name: '2.3: returnUser' } as unknown as UmlConnection,
      { id: 'c12', sourceId: 'ui_slot_11', targetId: 'usr_slot_11', type: 'reply', name: '2.4: authSuccess' } as unknown as UmlConnection,
    ];

    // Actor: usr has two activation bars: [0, 6] and [7, 11]
    const userActs = service.getNodeActivations(userNode, conns);
    expect(userActs.length).toBe(2);
    // Bar 1 for slot 0..6: startArrow = 157 - 65 = 92; top = 82; endArrow = 92 + 300 = 392; height = 300 + 20 = 320
    expect(userActs[0].top).toBe(82);
    expect(userActs[0].height).toBe(320);

    // Lifeline: ui has two activation bars: [0, 6] and [7, 11]
    const uiActs = service.getNodeActivations(authViewNode, conns);
    expect(uiActs.length).toBe(2);
    // Bar 1 for slot 0..6: startArrow = 157 - 60 = 97; top = 87; endArrow = 97 + 300 = 397; height = 320
    expect(uiActs[0].top).toBe(87);
    expect(uiActs[0].height).toBe(320);

    // Controller: ctrl has two activation bars: [1, 5] and [8, 10]
    // Because it waits for replies 1.5 (slot 5) and 2.3 (slot 10)
    const ctrlActs = service.getNodeActivations(ctrlNode, conns);
    expect(ctrlActs.length).toBe(2);
    // Bar 1 for slot 1..5: startArrow = 97 + 50 = 147; top = 137; endArrow = 97 + 250 = 347; height = 200 + 20 = 220
    expect(ctrlActs[0].top).toBe(137);
    expect(ctrlActs[0].height).toBe(220);

    // Repository: repo has three separate activation intervals: [2, 3], [4, 5], [9, 10]
    const repoActs = service.getNodeActivations(repoNode, conns);
    expect(repoActs.length).toBe(3);
    // Interval [2, 3]: startArrow = 97 + 100 = 197; top = 187; height = 50 + 20 = 70
    expect(repoActs[0].top).toBe(187);
    expect(repoActs[0].height).toBe(70);
    // Interval [4, 5]: startArrow = 97 + 200 = 297; top = 287; height = 50 + 20 = 70
    expect(repoActs[1].top).toBe(287);
    expect(repoActs[1].height).toBe(70);
  });
});
