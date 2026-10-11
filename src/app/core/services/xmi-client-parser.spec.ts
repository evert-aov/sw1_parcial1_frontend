import { describe, expect, it } from 'vitest';
import { XmiClientParser } from './xmi-client-parser';

interface SequenceFixtureMessage {
  id: string;
  source?: string;
  target?: string;
  name?: string;
  label?: string;
  geometry?: string;
  privateOrder?: string;
  appearance?: string;
  privateType?: string;
  callKind?: string;
  isReturn?: boolean;
  sort?: string;
  args?: string[];
  privateParams?: string;
}

function sequenceXml(messages: SequenceFixtureMessage[], extraDiagram = ''): string {
  const umlMessages = messages.map((m) => `<message xmi:id="${m.id}" name="${m.name || 'call'}" messageSort="${m.sort || 'synchCall'}">
    ${(m.args || []).map((arg) => `<argument name="${arg}"/>`).join('')}
  </message>`).join('');
  const connectors = messages.map((m) => `<connector xmi:idref="${m.id}">
    <source xmi:idref="${m.source || 'actor'}"/><target xmi:idref="${m.target || 'ui'}"/>
    <properties ea_type="Sequence" name="${m.name || 'call'}"/>
    ${m.label !== undefined ? `<labels mt="${m.label}"/>` : ''}
    ${m.appearance !== undefined ? `<appearance seqno="${m.appearance}"/>` : ''}
    <extendedProperties ${m.privateType ? `privatedata1="${m.privateType}"` : ''}
      ${m.callKind ? `privatedata3="${m.callKind}"` : ''}
      ${m.privateOrder !== undefined ? `privatedata5="${m.privateOrder}"` : ''}
      ${m.privateParams ? `privatedata2="${m.privateParams}"` : ''}
      ${m.isReturn ? 'privatedata4="1"' : ''}/>
  </connector>`).join('');
  return `<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
    <uml:Model><packagedElement xmi:type="uml:Package" xmi:id="package">
      <packagedElement xmi:type="uml:Actor" xmi:id="actor" name="Ingeniero Anfitrión"/>
      <packagedElement xmi:type="uml:Lifeline" xmi:id="ui" name="UI: ProjectView"/>
      <packagedElement xmi:type="uml:Lifeline" xmi:id="controller" name="ProjectController"/>
      <packagedElement xmi:type="uml:Lifeline" xmi:id="project" name="DB: Project"/>
      <packagedElement xmi:type="uml:Lifeline" xmi:id="member" name="DB: ProjectMember"/>
      <packagedElement xmi:type="uml:Lifeline" xmi:id="diagram" name="DB: Diagram"/>
      <packagedElement xmi:type="uml:Collaboration"><ownedBehavior xmi:type="uml:Interaction">
        ${umlMessages}
      </ownedBehavior></packagedElement>
    </packagedElement></uml:Model>
    <xmi:Extension><connectors>${connectors}</connectors><diagrams>
      <diagram><properties type="Sequence" name="CU-02: Gestión de Proyectos"/><elements>
        ${messages.filter((m) => m.geometry !== undefined).map((m) => `<element subject="${m.id}" geometry="${m.geometry}"/>`).join('')}
      </elements></diagram>${extraDiagram}
    </diagrams></xmi:Extension>
  </xmi:XMI>`;
}

// Snapshot reducido de docs/ea/ejemplos_xmi/secuencia.xml: alias de IDs,
// conservando orden XML, extremos, labels.mt, argumentos y los SeqNo discrepantes.
const eaFixture: SequenceFixtureMessage[] = [
  { id: 'updateProject', source: 'actor', target: 'ui', name: 'updateProject(id, updateData)', appearance: '7', privateOrder: 'SeqNo=8;' },
  { id: 'removeProject', source: 'actor', target: 'ui', name: 'removeProject(id)', appearance: '11', privateOrder: 'SeqNo=13;' },
  { id: 'createProject', source: 'actor', target: 'ui', name: 'createProject', label: ' createProject(data)', args: ['data'], appearance: '1', privateOrder: 'SeqNo=1;' },
  { id: 'removeProjectCard', source: 'ui', target: 'actor', name: 'removeProjectCard()', sort: 'reply', isReturn: true, appearance: '14', privateOrder: 'SeqNo=17;' },
  { id: 'showProjectUpdated', source: 'ui', target: 'actor', name: 'showProjectUpdated()', sort: 'reply', isReturn: true, appearance: '10', privateOrder: 'SeqNo=12;' },
  { id: 'showProjectCreated', source: 'ui', target: 'actor', name: 'showProjectCreated()', sort: 'reply', isReturn: true, appearance: '6', privateOrder: 'SeqNo=7;' },
  { id: 'createDiagram', source: 'controller', target: 'diagram', name: 'create', label: ' create(data)', args: ['data'], appearance: '5', privateOrder: 'SeqNo=5;' },
  { id: 'update', source: 'controller', target: 'project', name: 'update(id, data)', appearance: '9', privateOrder: 'SeqNo=10;' },
  { id: 'createProjectRecord', source: 'controller', target: 'project', name: 'create', label: ' create(data)', args: ['data'], appearance: '3', privateOrder: 'SeqNo=3;' },
  { id: 'delete', source: 'controller', target: 'project', name: 'delete(id)', appearance: '13', privateOrder: 'SeqNo=15;' },
  { id: 'save', source: 'controller', target: 'member', name: 'save', label: ' save(data)', args: ['data'], appearance: '4', privateOrder: 'SeqNo=4;' },
  { id: 'updateController', source: 'ui', target: 'controller', name: 'update', label: ' update(id, updateData)', args: ['id', ' updateData'], appearance: '8', privateOrder: 'SeqNo=9;' },
  { id: 'remove', source: 'ui', target: 'controller', name: 'remove(id)', appearance: '12', privateOrder: 'SeqNo=14;' },
  { id: 'create', source: 'ui', target: 'controller', name: 'create', label: ' create(data)', args: ['data'], appearance: '2', privateOrder: 'SeqNo=2;' },
].map((m) => ({ ...m, geometry: `SX=0;SY=0;${m.privateOrder}`, privateType: 'Synchronous', callKind: 'Call' }));

const expectedSequences = ['1', '1.1', '1.2', '1.3', '1.4', '1.5', '2', '2.1', '2.2', '2.3', '3', '3.1', '3.2', '3.3'];

const expectedIds = [
  'createProject', 'create', 'createProjectRecord', 'save', 'createDiagram', 'showProjectCreated',
  'updateProject', 'updateController', 'update', 'showProjectUpdated',
  'removeProject', 'remove', 'delete', 'removeProjectCard',
];

function parseMessages(messages: SequenceFixtureMessage[], extraDiagram = '') {
  return XmiClientParser.parse(sequenceXml(messages, extraDiagram));
}

describe('XmiClientParser: secuencia EA', () => {
  it('importa los 14 mensajes del fixture con actores, parámetros, slots y orden global', () => {
    const result = parseMessages(eaFixture);
    expect(result.diagramType).toBe('sequence');
    expect(result.nodes.filter((n) => n.nodeType === 'actor').map((n) => n.name)).toEqual(['Ingeniero Anfitrión']);
    expect(result.nodes.filter((n) => n.nodeType === 'lifeline').map((n) => n.color)).toEqual(Array(5).fill('#DDF4F5'));
    expect(result.nodes.filter((n) => n.nodeType === 'lifeline').map((n) => n.height)).toEqual(Array(5).fill(60));
    expect(result.connections.map((c) => c.id)).toEqual(expectedIds);
    result.connections.forEach((c, index) => {
      expect(c.sourceId).toBe(`${c.sourceNodeId}_slot_${index}`);
      expect(c.targetId).toBe(`${c.targetNodeId}_slot_${index}`);
      expect(c.messages).toHaveLength(1);
      expect(c.messages![0]).toMatchObject({ orderIndex: index, sequenceNumber: expectedSequences[index], direction: 'forward' });
    });
    expect(result.connections[0].messages![0]).toMatchObject({ functionName: 'createProject', parameters: 'data' });
    expect(result.connections[7].messages![0]).toMatchObject({ functionName: 'update', parameters: 'id, updateData' });
    for (const c of result.connections.filter((c) => c.type === 'reply')) {
      expect(c.sourceNodeId).toBe('ui');
      expect(c.targetNodeId).toBe('actor');
      expect(c.messages![0]).toMatchObject({ isReturn: true, direction: 'forward' });
    }
    // Una función llamada create no es necesariamente un createMessage UML.
    expect(result.connections.find((c) => c.id === 'create')!.type).toBe('sync');
  });

  it('conserva un color explícito EA mientras las demás líneas de vida usan el color predeterminado', () => {
    const xml = sequenceXml(eaFixture).replace('<elements>', '<elements><element subject="ui" geometry="Left=100;Top=50;Right=210;Bottom=765;" style="BCol=5649426;"/>');
    const result = XmiClientParser.parse(xml);
    expect(result.nodes.find((n) => n.id === 'ui')?.color).toBe('#123456');
    expect(result.nodes.filter((n) => n.nodeType === 'lifeline' && n.id !== 'ui').every((n) => n.color === '#DDF4F5')).toBe(true);
  });

  it('convierte etiquetas planas EA en grupos por actor y mantiene retornos y colores en el mismo grupo', () => {
    const result = parseMessages(eaFixture.map((message) => ({
      ...message, label: `${message.appearance}: ${(message.label || message.name || '').trim()}`,
    })));
    expect(result.connections.map((c) => c.messages![0].sequenceNumber)).toEqual(expectedSequences);
    expect(result.connections.map((c) => c.messages![0].orderIndex)).toEqual(expectedIds.map((_, index) => index));
    for (const [start, end] of [[0, 6], [6, 10], [10, 14]]) {
      expect(new Set(result.connections.slice(start, end).map((c) => c.messages![0].color)).size).toBe(1);
      expect(result.connections[end - 1].type).toBe('reply');
    }
  });

  it('prioriza la geometría del diagrama seleccionado sobre extensión y appearance, incluido cero', () => {
    const result = parseMessages([
      { id: 'later', geometry: 'SeqNo=1;', privateOrder: 'SeqNo=0;', appearance: '0' },
      { id: 'first', geometry: 'SeqNo=0;', privateOrder: 'SeqNo=50;', appearance: '50' },
    ], '<diagram><elements><element subject="later" geometry="SeqNo=0;"/><element subject="first" geometry="SeqNo=99;"/></elements></diagram>');
    expect(result.connections.map((c) => c.id)).toEqual(['first', 'later']);
  });

  it('usa privatedata5 antes de appearance y acepta cero en ambos fallbacks', () => {
    expect(parseMessages([
      { id: 'later', privateOrder: 'SeqNo=2;', appearance: '0' },
      { id: 'first', privateOrder: 'SeqNo=0;', appearance: '20' },
      { id: 'middle', privateOrder: 'SeqNo=invalid;', appearance: '1' },
    ]).connections.map((c) => c.id)).toEqual(['first', 'middle', 'later']);
    expect(parseMessages([
      { id: 'later', appearance: '2' }, { id: 'first', appearance: '0' },
    ]).connections.map((c) => c.id)).toEqual(['first', 'later']);
  });

  it('mantiene el orden XML para empates o ausencia de metadatos válidos', () => {
    expect(parseMessages([{ id: 'a' }, { id: 'b' }, { id: 'c', appearance: 'NaN' }])
      .connections.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(parseMessages([{ id: 'b', appearance: '0' }, { id: 'a', appearance: '0' }])
      .connections.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('preserva labels.mt jerárquico independientemente de su posición cronológica', () => {
    const result = parseMessages([
      { id: 'b', name: 'wrong', label: ' 1.2.3: nested(id, data)', geometry: 'SeqNo=0;' },
      { id: 'a', label: '2: next()', geometry: 'SeqNo=1;' },
    ]);
    expect(result.connections[0].messages![0]).toMatchObject({ sequenceNumber: '1.2.3', functionName: 'nested', parameters: 'id, data', orderIndex: 0 });
    expect(result.connections[1].messages![0]).toMatchObject({ sequenceNumber: '2', functionName: 'next', orderIndex: 1 });
  });

  it('recupera argumentos UML y messageSort con extensión incompleta', () => {
    const result = parseMessages([
      { id: 'async', sort: 'asynchSignal', args: ['id', ' data'] },
      { id: 'create', sort: 'createMessage', args: ['newData'] },
      { id: 'reply', source: 'ui', target: 'actor', sort: 'reply' },
    ]);
    expect(result.connections.map((c) => c.type)).toEqual(['async', 'create', 'reply']);
    expect(result.connections[0].messages![0].parameters).toBe('id, data');
    expect(result.connections[1].messages![0].parameters).toBe('newData');
    expect(result.connections[2].messages![0]).toMatchObject({ type: 'reply', isReturn: true, direction: 'forward' });
  });

  it('reconoce tipos EA async/create y parámetros de extensión sin inferirlos del nombre', () => {
    const result = parseMessages([
      { id: 'async', privateType: 'Asynchronous', privateParams: 'paramsDlg=arg;retval=Result;', args: ['fallback'] },
      { id: 'create', callKind: 'Create', name: 'factory' },
    ]);
    expect(result.connections.map((c) => c.type)).toEqual(['async', 'create']);
    expect(result.connections[0].messages![0]).toMatchObject({ parameters: 'arg', returnType: 'Result' });
  });
});

describe('XmiClientParser: paquete EA', () => {
  it('detecta diagramType package y admite la composición de {package, use_case, actor}', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const fixturePath = path.resolve(__dirname, '../../../../../docs/ea/ejemplos_xmi/paquetes.xml');
    const xmlContent = fs.readFileSync(fixturePath, 'utf-8');

    const result = XmiClientParser.parse(xmlContent);
    expect(result.diagramType).toBe('package');

    // Debe contener nodos de tipo paquete y casos de uso del diagrama
    const packageNodes = result.nodes.filter((n) => n.nodeType === 'package');
    expect(packageNodes.length).toBe(5);
    const useCaseNodes = result.nodes.filter((n) => n.nodeType === 'use_case');
    expect(useCaseNodes.length).toBe(8);

    // Todos los nodos del diagrama de paquetes deben ser {package, use_case, actor}
    expect(result.nodes.every((n) => n.nodeType === 'package' || n.nodeType === 'use_case' || n.nodeType === 'actor')).toBe(true);

    const pkgNames = packageNodes.map((n) => n.name);
    expect(pkgNames).toContain('AI-assistant');
    expect(pkgNames).toContain('Auth');
    expect(pkgNames).toContain('Code-generator');
    expect(pkgNames).toContain('Diagrams');
    expect(pkgNames).toContain('Projects');

    // Verificar que los caracteres acentuados codificados como entidades numéricas HTML (ej. &#243;) se decodificaron correctamente
    const authPkg = packageNodes.find((n) => n.name === 'Auth');
    expect(authPkg).toBeDefined();
    expect(authPkg?.attributes.length).toBeGreaterThan(0);
    expect(authPkg?.attributes[0].name).toBe('Autenticación y Perfiles');

    const projectsPkg = packageNodes.find((n) => n.name === 'Projects');
    expect(projectsPkg).toBeDefined();
    expect(projectsPkg?.attributes.length).toBeGreaterThan(0);
    expect(projectsPkg?.attributes[0].name).toBe('Gestión de Proyectos, Equipos y Modelado en Tiempo Real');

    // Debe contener dependencias válidas
    expect(result.connections.length).toBeGreaterThan(0);
    expect(result.connections.every((c) => c.type === 'dependency' || c.type === 'import' || c.type === 'merge')).toBe(true);
  });

  it('decodifica entidades numéricas y HTML en fixUtf8Mojibake', () => {
    expect(XmiClientParser.fixUtf8Mojibake('Autenticaci&#243;n y Perfiles')).toBe('Autenticación y Perfiles');
    expect(XmiClientParser.fixUtf8Mojibake('Gesti&#243;n de Proyectos')).toBe('Gestión de Proyectos');
    expect(XmiClientParser.fixUtf8Mojibake('&#193;&#201;&#205;&#211;&#218;&#209;')).toBe('ÁÉÍÓÚÑ');
    expect(XmiClientParser.fixUtf8Mojibake('&aacute;&eacute;&iacute;&oacute;&uacute;&ntilde;')).toBe('áéíóúñ');
    expect(XmiClientParser.fixUtf8Mojibake('&#xF3;')).toBe('ó');
  });

  describe('XmiClientParser: componente EA', () => {
    it('importa componente_2.xml detectando diagramType component, nodos y conectores assembly', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const fixturePath = path.resolve(__dirname, '../../../../../docs/ea/ejemplos_xmi/componente_2.xml');
      const xmlContent = fs.readFileSync(fixturePath, 'latin1');

      const result = XmiClientParser.parse(xmlContent);
      expect(result.diagramType).toBe('component');

      const components = result.nodes.filter((n) => n.nodeType === 'component');
      expect(components.length).toBe(11);

      const boundaries = result.nodes.filter((n) => n.nodeType === 'boundary_box');
      expect(boundaries.length).toBe(3);

      // Todos los nodos deben pertenecer a {component, boundary_box, package, class}
      expect(result.nodes.every((n) => ['component', 'boundary_box', 'package', 'class'].includes(n.nodeType || ''))).toBe(true);

      // Verificar conectores assembly y dependency
      const assemblyConns = result.connections.filter((c) => c.type === 'assembly');
      expect(assemblyConns.length).toBeGreaterThan(0);

      const depConns = result.connections.filter((c) => c.type === 'dependency');
      expect(depConns.length).toBeGreaterThan(0);

      // Verificar que los componentes tienen dimensiones y color adecuados
      const comp1 = components.find((c) => c.name.includes('collaboration.gateway.ts'));
      expect(comp1).toBeDefined();
      expect(comp1?.width).toBeGreaterThanOrEqual(160);
      expect(comp1?.height).toBeGreaterThanOrEqual(60);
    });

    it('importa componentes.xml detectando diagramType component', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const fixturePath = path.resolve(__dirname, '../../../../../docs/ea/ejemplos_xmi/componentes.xml');
      const xmlContent = fs.readFileSync(fixturePath, 'latin1');

      const result = XmiClientParser.parse(xmlContent);
      expect(result.diagramType).toBe('component');

      const components = result.nodes.filter((n) => n.nodeType === 'component');
      expect(components.length).toBeGreaterThan(0);
    });
  });
});

