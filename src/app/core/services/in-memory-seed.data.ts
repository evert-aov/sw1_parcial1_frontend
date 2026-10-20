import { User } from '../models/user.model';
import { Project } from '../models/project.model';
import { DiagramDto, DiagramType, UmlNodeType } from '../models/diagram.model';
import { CodeGenerationPreviewResponse, GenerateCodeRequest, GeneratedFile } from './code-generator.service';

export const IN_MEMORY_TOKEN_PREFIX = 'in-memory-token-';

export const DEFAULT_IN_MEMORY_USER: User = {
  id: 'usr-in-memory-001',
  fullName: 'Ing. Demo Arquitecto (Memoria)',
  email: 'demo@uagrm.edu.bo',
  isActive: true,
  createdAt: '2026-10-19T08:00:00.000Z',
};

export const INITIAL_IN_MEMORY_PROJECTS: Project[] = [
  {
    id: 'proj-in-memory-001',
    name: 'Sistema E-Commerce & Gestión Académica',
    description: 'Proyecto demostrativo en memoria con diagramas UML 2.5 listos para previsualizar y editar.',
    basePackage: 'bo.edu.uagrm.ecommerce',
    javaVersion: 21,
    springBootVersion: '3.4.0',
    createdBy: DEFAULT_IN_MEMORY_USER.id,
    creatorName: DEFAULT_IN_MEMORY_USER.fullName,
    userRole: 'OWNER',
    memberCount: 1,
    diagramCount: 2,
    createdAt: '2026-10-19T08:00:00.000Z',
    members: [
      {
        id: 'mem-in-memory-001',
        userId: DEFAULT_IN_MEMORY_USER.id,
        fullName: DEFAULT_IN_MEMORY_USER.fullName,
        email: DEFAULT_IN_MEMORY_USER.email,
        role: 'OWNER',
        joinedAt: '2026-10-19T08:00:00.000Z',
      },
    ],
  },
];

export const INITIAL_IN_MEMORY_DIAGRAMS: DiagramDto[] = [
  {
    id: 'diag-in-memory-001',
    projectId: 'proj-in-memory-001',
    name: 'Modelo de Dominio Principal',
    type: DiagramType.CLASS,
    version: '1.0.0',
    defaultLineStyle: 'segment',
    createdAt: '2026-10-19T08:00:00.000Z',
    updatedAt: '2026-10-19T08:00:00.000Z',
    nodes: [
      {
        id: 'node_mem_usuario',
        name: 'Usuario',
        positionX: 80,
        positionY: 120,
        width: 240,
        nodeType: UmlNodeType.CLASS,
        stereotype: 'entity',
        attributes: [
          { name: 'id', type: 'UUID', visibility: '-', isPk: true },
          { name: 'nombreCompleto', type: 'String', visibility: '-' },
          { name: 'email', type: 'String', visibility: '-', isUnique: true },
          { name: 'activo', type: 'Boolean', visibility: '-' },
        ],
        methods: [
          { name: 'autenticar', parameters: 'password: String', returnType: 'Boolean', visibility: '+' },
          { name: 'actualizarPerfil', parameters: 'nombre: String', returnType: 'void', visibility: '+' },
        ],
      },
      {
        id: 'node_mem_pedido',
        name: 'Pedido',
        positionX: 460,
        positionY: 120,
        width: 250,
        nodeType: UmlNodeType.CLASS,
        stereotype: 'entity',
        attributes: [
          { name: 'id', type: 'UUID', visibility: '-', isPk: true },
          { name: 'fechaCreacion', type: 'LocalDateTime', visibility: '-' },
          { name: 'total', type: 'BigDecimal', visibility: '-' },
          { name: 'estado', type: 'String', visibility: '-' },
        ],
        methods: [
          { name: 'calcularTotal', parameters: '', returnType: 'BigDecimal', visibility: '+' },
          { name: 'confirmar', parameters: '', returnType: 'Boolean', visibility: '+' },
        ],
      },
      {
        id: 'node_mem_producto',
        name: 'Producto',
        positionX: 840,
        positionY: 120,
        width: 240,
        nodeType: UmlNodeType.CLASS,
        stereotype: 'entity',
        attributes: [
          { name: 'id', type: 'UUID', visibility: '-', isPk: true },
          { name: 'codigo', type: 'String', visibility: '-', isUnique: true },
          { name: 'nombre', type: 'String', visibility: '-' },
          { name: 'precioUnitario', type: 'BigDecimal', visibility: '-' },
          { name: 'stock', type: 'Integer', visibility: '-' },
        ],
        methods: [
          { name: 'descontarStock', parameters: 'cantidad: Integer', returnType: 'void', visibility: '+' },
        ],
      },
    ],
    connections: [
      {
        id: 'conn_mem_1',
        sourceNodeId: 'node_mem_usuario',
        targetNodeId: 'node_mem_pedido',
        sourceId: 'node_mem_usuario_right',
        targetId: 'node_mem_pedido_left',
        type: 'association',
        lineStyle: 'segment',
        name: 'realiza',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
      {
        id: 'conn_mem_2',
        sourceNodeId: 'node_mem_pedido',
        targetNodeId: 'node_mem_producto',
        sourceId: 'node_mem_pedido_right',
        targetId: 'node_mem_producto_left',
        type: 'aggregation',
        lineStyle: 'segment',
        name: 'contiene',
        sourceMultiplicity: '1..*',
        targetMultiplicity: '1..*',
      },
    ],
  },
  {
    id: 'diag-in-memory-002',
    projectId: 'proj-in-memory-001',
    name: 'Casos de Uso E-Commerce',
    type: DiagramType.USE_CASE,
    version: '1.0.0',
    defaultLineStyle: 'straight',
    createdAt: '2026-10-19T08:00:00.000Z',
    updatedAt: '2026-10-19T08:00:00.000Z',
    nodes: [
      {
        id: 'node_mem_actor_1',
        name: 'Cliente',
        positionX: 120,
        positionY: 180,
        width: 90,
        height: 110,
        nodeType: UmlNodeType.ACTOR,
        attributes: [],
        methods: [],
      },
      {
        id: 'node_mem_uc_1',
        name: 'Gestionar Carrito de Compras',
        positionX: 380,
        positionY: 130,
        width: 210,
        height: 85,
        nodeType: UmlNodeType.USE_CASE,
        attributes: [],
        methods: [],
      },
      {
        id: 'node_mem_uc_2',
        name: 'Procesar Pago en Línea',
        positionX: 380,
        positionY: 270,
        width: 210,
        height: 85,
        nodeType: UmlNodeType.USE_CASE,
        attributes: [],
        methods: [],
      },
    ],
    connections: [
      {
        id: 'conn_mem_uc_1',
        sourceNodeId: 'node_mem_actor_1',
        targetNodeId: 'node_mem_uc_1',
        sourceId: 'node_mem_actor_1_right',
        targetId: 'node_mem_uc_1_left',
        type: 'association',
        lineStyle: 'straight',
      },
      {
        id: 'conn_mem_uc_2',
        sourceNodeId: 'node_mem_uc_1',
        targetNodeId: 'node_mem_uc_2',
        sourceId: 'node_mem_uc_1_bottom',
        targetId: 'node_mem_uc_2_top',
        type: 'include',
        lineStyle: 'straight',
      },
    ],
  },
];

export function buildInMemoryCodePreview(
  diagram: DiagramDto,
  payload: GenerateCodeRequest,
): CodeGenerationPreviewResponse {
  const pkg = payload.packageName || 'bo.edu.uagrm.app';
  const pkgPath = pkg.replace(/\./g, '/');
  const projectName = payload.projectName || diagram.name || 'uml-spring-boot-app';
  const classNodes = (diagram.nodes || []).filter((n) => !n.nodeType || n.nodeType === UmlNodeType.CLASS);

  const files: GeneratedFile[] = classNodes.map((node) => {
    const className = node.name.replace(/[^a-zA-Z0-9_]/g, '') || 'DomainEntity';
    const fields = (node.attributes || [])
      .map((attr) => `    private ${attr.type || 'String'} ${attr.name};`)
      .join('\n');
    return {
      path: `src/main/java/${pkgPath}/entity/${className}.java`,
      filename: `${className}.java`,
      language: 'java',
      layer: 'entity',
      content: `package ${pkg}.entity;\n\nimport jakarta.persistence.*;\nimport java.util.UUID;\nimport java.math.BigDecimal;\nimport java.time.LocalDateTime;\n\n@Entity\n@Table(name = "${className.toLowerCase()}s")\npublic class ${className} {\n${fields || '    @Id\n    private UUID id;'}\n}\n`,
    };
  });

  return {
    projectName,
    totalFiles: files.length,
    files,
  };
}
