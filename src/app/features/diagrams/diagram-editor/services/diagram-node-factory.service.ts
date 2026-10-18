import { Injectable } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlStereotype,
} from '../../../../core/models/diagram.model';

export interface ScrollOffset {
  scrollLeft: number;
  scrollTop: number;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramNodeFactoryService {
  private calcPos(
    position: { x: number; y: number } | undefined,
    offsetX: number,
    offsetY: number,
    scroll?: ScrollOffset,
  ): { x: number; y: number } {
    const sLeft = scroll?.scrollLeft || 0;
    const sTop = scroll?.scrollTop || 0;
    const posX = position
      ? Math.max(20, Math.round(position.x - offsetX))
      : Math.max(50, Math.round(sLeft + 120 + Math.random() * 60));
    const posY = position
      ? Math.max(20, Math.round(position.y - offsetY))
      : Math.max(50, Math.round(sTop + 80 + Math.random() * 60));
    return { x: posX, y: posY };
  }

  createClassNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    stereotype?: UmlStereotype | string | null,
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const defaultWidth = 220;
    const defaultHeight = stereotype ? 120 : undefined;
    const pos = this.calcPos(
      position,
      defaultWidth / 2,
      defaultHeight ? defaultHeight / 2 : 40,
      scroll,
    );

    const count = nodes.filter((n) => !n.isAnchor).length + 1;
    let namePrefix = 'Tabla_';
    if (stereotype === UmlStereotype.UI || stereotype === 'UI') {
      namePrefix = 'UI_';
    } else if (stereotype === UmlStereotype.CONTROLLER_DOT || stereotype === 'Controller.') {
      namePrefix = 'Controller_';
    } else if (stereotype === UmlStereotype.ENTITY_DOT || stereotype === 'Entity.') {
      namePrefix = 'Entity_';
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      namePrefix = 'Clase_';
    }

    let initialStereotype: UmlStereotype | string | null = (stereotype as UmlStereotype) || null;
    if (currentType === DiagramType.CLASS) {
      initialStereotype = null;
    } else if (initialStereotype && (initialStereotype as string).toLowerCase() === 'class') {
      initialStereotype = null;
    }

    return {
      id: `class_${Date.now()}`,
      name: `${namePrefix}${count}`,
      nodeType: 'class',
      position: pos,
      width: defaultWidth,
      height: defaultHeight,
      color: '#FDFAF3',
      attributes: [],
      methods: [],
      stereotype: initialStereotype,
    };
  }

  createComponentNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 95, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'component').length + 1;
    return {
      id: `component_${Date.now()}`,
      name: `Component_${count}`,
      nodeType: 'component',
      stereotype: 'file',
      position: pos,
      width: 190,
      height: 70,
      customWidth: 190,
      customHeight: 70,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };
  }

  createDeviceNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 115, 70, scroll);
    const count = nodes.filter((n) => n.nodeType === 'device').length + 1;
    return {
      id: `device_${Date.now()}`,
      name: `Dispositivo_${count}`,
      nodeType: 'device',
      stereotype: 'device',
      position: pos,
      width: 230,
      height: 140,
      customWidth: 230,
      customHeight: 140,
      isCustomSize: true,
      color: '#F3FAF7',
      attributes: [],
      methods: [],
    };
  }

  createExecutionEnvironmentNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 120, 80, scroll);
    const count = nodes.filter((n) => n.nodeType === 'executionEnvironment').length + 1;
    return {
      id: `exec_env_${Date.now()}`,
      name: `Servidor_${count}`,
      nodeType: 'executionEnvironment',
      stereotype: 'executionEnvironment',
      position: pos,
      width: 240,
      height: 160,
      customWidth: 240,
      customHeight: 160,
      isCustomSize: true,
      color: '#CDE5F5',
      attributes: [],
      methods: [],
    };
  }

  createBoundaryBoxNode(
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const isLayered = currentType === DiagramType.LAYERED;
    const isComponent = currentType === DiagramType.COMPONENT;
    const defaultWidth = (isLayered || isComponent) ? 420 : 280;
    const defaultHeight = (isLayered || isComponent) ? 220 : 200;
    const defaultName = isLayered ? 'Capa' : (isComponent ? 'Agrupación' : '.');
    const pos = this.calcPos(position, defaultWidth / 2, defaultHeight / 2, scroll);

    return {
      id: `boundary_box_${Date.now()}`,
      name: defaultName,
      nodeType: 'boundary_box',
      stereotype: null,
      position: pos,
      width: defaultWidth,
      height: defaultHeight,
      customWidth: defaultWidth,
      customHeight: defaultHeight,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };
  }

  createActorNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const isSequence = currentType === DiagramType.SEQUENCE;
    let pos = this.calcPos(position, 32, 47, scroll);

    if (isSequence) {
      pos.y = 50;
      if (!position) {
        const topNodes = nodes.filter(
          (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
        );
        if (topNodes.length > 0) {
          const maxRight = Math.max(...topNodes.map((n) => (n.position?.x || 0) + (n.width || 120)));
          pos.x = maxRight + 60;
        } else {
          pos.x = 80;
        }
      }
    }

    const count = nodes.filter((n) => n.nodeType === 'actor').length + 1;
    return {
      id: `actor_${Date.now()}`,
      name: isSequence ? `actor_${count}` : `Actor_${count}`,
      nodeType: 'actor',
      position: pos,
      width: 65,
      height: 95,
      color: '#FEF2DD',
      attributes: [],
      methods: [],
      activations: [],
    };
  }

  createUseCaseNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 70, 30, scroll);
    const count = nodes.filter((n) => n.nodeType === 'use_case').length + 1;
    return {
      id: `use_case_${Date.now()}`,
      name: `CasoDeUso_${count}`,
      nodeType: 'use_case',
      position: pos,
      width: 140,
      height: 60,
      color: '#E5F2FE',
      attributes: [],
      methods: [],
    };
  }

  createPackageNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 100, 60, scroll);
    const count = nodes.filter((n) => n.nodeType === 'package').length + 1;
    return {
      id: `package_${Date.now()}`,
      name: `Paquete_${count}`,
      nodeType: 'package',
      position: pos,
      width: 200,
      height: 120,
      color: '#FAF1EC',
      attributes: [{ name: `Contenido Paquete ${count}`, type: 'package' }],
      methods: [],
    };
  }

  createBoundaryNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 35, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'boundary').length + 1;
    return {
      id: `boundary_${Date.now()}`,
      name: `Boundary_${count}`,
      nodeType: 'boundary',
      stereotype: UmlStereotype.BOUNDARY,
      position: pos,
      width: 70,
      height: 70,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };
  }

  createControlNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 35, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'control').length + 1;
    return {
      id: `control_${Date.now()}`,
      name: `Control_${count}`,
      nodeType: 'control',
      stereotype: UmlStereotype.CONTROL,
      position: pos,
      width: 70,
      height: 70,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };
  }

  createEntityNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 35, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'entity').length + 1;
    return {
      id: `entity_${Date.now()}`,
      name: `Entity_${count}`,
      nodeType: 'entity',
      stereotype: UmlStereotype.ENTITY,
      position: pos,
      width: 70,
      height: 70,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };
  }

  createLifelineNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const isSequence = currentType === DiagramType.SEQUENCE;
    let pos = this.calcPos(position, 80, 24, scroll);

    if (isSequence) {
      pos.y = 50;
      if (!position) {
        const topNodes = nodes.filter(
          (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
        );
        if (topNodes.length > 0) {
          const maxRight = Math.max(...topNodes.map((n) => (n.position?.x || 0) + (n.width || 140)));
          pos.x = maxRight + 60;
        } else {
          pos.x = 80;
        }
      }
    }

    const count = nodes.filter((n) => n.nodeType === 'lifeline').length + 1;
    const defaultName = isSequence ? `lifeline_${count}` : `Objeto_${count}`;

    return {
      id: `lifeline_${Date.now()}`,
      name: defaultName,
      nodeType: 'lifeline',
      position: pos,
      width: 160,
      height: 60,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
      activations: [],
    };
  }

  createNoteNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 90, 38, scroll);
    const count = nodes.filter((n) => n.nodeType === 'note').length + 1;
    return {
      id: `note_${Date.now()}`,
      name: `Nota descriptiva ${count}...`,
      nodeType: 'note',
      stereotype: 'note',
      position: pos,
      width: 185,
      height: 76,
      customWidth: 185,
      customHeight: 76,
      isCustomSize: true,
      color: '#FEF9C3',
      attributes: [],
      methods: [],
    };
  }

  createPackageLayerNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    const pos = this.calcPos(position, 210, 100, scroll);
    const count = nodes.filter((n) => n.nodeType === 'package_layer').length + 1;
    return {
      id: `layer_${Date.now()}`,
      name: `Capa Arquitectónica ${count}`,
      nodeType: 'package_layer',
      position: pos,
      width: 420,
      height: 200,
      customWidth: 420,
      customHeight: 200,
      isCustomSize: true,
      color: 'rgba(248, 250, 252, 0.65)',
      attributes: [],
      methods: [],
    };
  }

  createActivityNode(
    subType: 'activity_initial' | 'activity_final' | 'activity_action' | 'activity_decision' | 'activity_fork' | string,
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    let width = 155;
    let height = 62;
    let name = 'Acción';

    if (subType === 'activity_initial') {
      width = 44;
      height = 48;
      name = 'Initial';
    } else if (subType === 'activity_final') {
      width = 44;
      height = 48;
      name = 'Final';
    } else if (subType === 'activity_decision') {
      width = 65;
      height = 65;
      name = 'Decision';
    } else if (subType === 'activity_fork') {
      width = 220;
      height = 14;
      name = 'Fork/Join';
    }

    const pos = this.calcPos(position, width / 2, height / 2, scroll);
    const count = nodes.filter((n) => n.nodeType === subType).length + 1;

    return {
      id: `${subType}_${Date.now()}`,
      name: subType === 'activity_action' ? `Acción_${count}` : name,
      nodeType: subType,
      position: pos,
      width,
      height,
      customWidth: width,
      customHeight: height,
      isCustomSize: true,
      attributes: [],
      methods: [],
    };
  }
}
