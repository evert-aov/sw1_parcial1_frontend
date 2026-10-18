import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramNodeOperationsService } from './diagram-node-operations.service';
import { DiagramType } from '../../../../core/models/diagram.model';

describe('DiagramNodeOperationsService: Validación estricta por tipo de diagrama', () => {
  let service: DiagramNodeOperationsService;

  beforeEach(() => {
    service = new DiagramNodeOperationsService({} as any);
  });

  it('en DiagramType.CLASS solo permite clases estándar y rechaza otros tipos de elementos', () => {
    expect(service.validateNodeAddition('class', DiagramType.CLASS).allowed).toBe(true);
    expect(service.validateNodeAddition('actor', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('use_case', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('package', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('component', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('device', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('lifeline', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('boundary', DiagramType.CLASS).allowed).toBe(false);
    expect(service.validateNodeAddition('boundary_box', DiagramType.CLASS).allowed).toBe(false);
  });

  it('en DiagramType.USE_CASE solo permite actores, casos de uso y boundary_box', () => {
    expect(service.validateNodeAddition('actor', DiagramType.USE_CASE).allowed).toBe(true);
    expect(service.validateNodeAddition('use_case', DiagramType.USE_CASE).allowed).toBe(true);
    expect(service.validateNodeAddition('boundary_box', DiagramType.USE_CASE).allowed).toBe(true);
    expect(service.validateNodeAddition('class', DiagramType.USE_CASE).allowed).toBe(false);
    expect(service.validateNodeAddition('package', DiagramType.USE_CASE).allowed).toBe(false);
    expect(service.validateNodeAddition('device', DiagramType.USE_CASE).allowed).toBe(false);
    expect(service.validateNodeAddition('lifeline', DiagramType.USE_CASE).allowed).toBe(false);
  });

  it('en DiagramType.COMMUNICATION solo permite actores y símbolos BCE puros', () => {
    expect(service.validateNodeAddition('actor', DiagramType.COMMUNICATION).allowed).toBe(true);
    expect(service.validateNodeAddition('boundary', DiagramType.COMMUNICATION).allowed).toBe(true);
    expect(service.validateNodeAddition('control', DiagramType.COMMUNICATION).allowed).toBe(true);
    expect(service.validateNodeAddition('entity', DiagramType.COMMUNICATION).allowed).toBe(true);
    expect(service.validateNodeAddition('class', DiagramType.COMMUNICATION).allowed).toBe(false);
    expect(service.validateNodeAddition('use_case', DiagramType.COMMUNICATION).allowed).toBe(false);
    expect(service.validateNodeAddition('device', DiagramType.COMMUNICATION).allowed).toBe(false);
  });

  it('en DiagramType.CLASS_ANALYSIS permite clases y actores pero rechaza símbolos BCE puros y casos de uso', () => {
    expect(service.validateNodeAddition('class', DiagramType.CLASS_ANALYSIS).allowed).toBe(true);
    expect(service.validateNodeAddition('actor', DiagramType.CLASS_ANALYSIS).allowed).toBe(true);
    expect(service.validateNodeAddition('boundary', DiagramType.CLASS_ANALYSIS).allowed).toBe(false);
    expect(service.validateNodeAddition('control', DiagramType.CLASS_ANALYSIS).allowed).toBe(false);
    expect(service.validateNodeAddition('entity', DiagramType.CLASS_ANALYSIS).allowed).toBe(false);
    expect(service.validateNodeAddition('use_case', DiagramType.CLASS_ANALYSIS).allowed).toBe(false);
  });
});
