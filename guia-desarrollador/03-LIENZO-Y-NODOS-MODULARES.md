# 03 - Lienzo y Nodos Modulares (@foblex/flow)

## 1. Visión General del Lienzo
El lienzo de dibujo está implementado en [`DiagramCanvasComponent`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/diagram-canvas.component.ts) y utiliza la librería `@foblex/flow`.

El lienzo se encarga de:
1. Renderizar la grilla de fondo paramétrica (`f-background`).
2. Gestionar la interacción de paneo y zoom de la cámara (`f-canvas`).
3. Orquestar el dibujo y renderizado de conexiones y relaciones (`f-connection`).
4. Alojar los nodos visuales de los diagramas (`f-node`).

---

## 2. Los 8 Nodos Especializados en `diagram-canvas/nodes/`

Cada nodo del editor ha sido desacoplado en su propio componente standalone en [`frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/nodes/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/nodes/):

```
nodes/
├── uml-class-node/       # Clases UML estándar y tipos definidos
├── uml-use-case-node/    # Casos de Uso (óvalos de negocio)
├── uml-actor-node/       # Actores humanos o sistemas externos
├── uml-robustness-node/  # Análisis de Robustez BCE (Boundary, Control, Entity)
├── uml-lifeline-node/    # Líneas de vida para diagramas de Secuencia
├── uml-package-node/     # Paquetes y capas de software agrupadoras
├── uml-component-node/   # Componentes modulares con puertos
├── uml-deployment-node/  # Nodos físicos 3D isométricos de despliegue
└── index.ts              # Barrel export de UML_CANVAS_NODE_COMPONENTS
```

### 1. `UmlClassNodeComponent` (`<app-uml-class-node>`)
- Renderiza el rectángulo tripartito estándar de UML:
  - **Cabecera**: Estereotipo (`<<interface>>`, `<<abstract>>`), nombre de la clase y candado de concurrencia.
  - **Compartimento de Atributos**: Lista de atributos con visibilidad (`+`, `-`, `#`, `~`), tipo de dato y subrayado de clave primaria.
  - **Compartimento de Métodos**: Lista de operaciones con visibilidad, parámetros y tipo de retorno.
- Soporta edición directa in-place con doble clic.

### 2. `UmlUseCaseNodeComponent` (`<app-uml-use-case-node>`)
- Renderiza el óvalo de caso de uso con tipografía centrada y ajuste automático de texto (*word-wrap*).

### 3. `UmlActorNodeComponent` (`<app-uml-actor-node>`)
- Renderiza la figura humana clásica (*stickman*) mediante SVG vectorial y etiqueta inferior arrastrable con offset independiente.

### 4. `UmlRobustnessNodeComponent` (`<app-uml-robustness-node>`)
- Renderiza la notación del análisis BCE (Booch / Jacobson):
  - **Boundary / Frontera**: Círculo con barra vertical a la izquierda (interfaz de usuario o API).
  - **Control**: Círculo con flecha en la parte superior (coordinador o servicio).
  - **Entity / Entidad**: Círculo con base subrayada horizontal (modelo de datos persistente).

### 5. `UmlLifelineNodeComponent` (`<app-uml-lifeline-node>`)
- Renderiza la cabecera superior y la línea punteada vertical discontinua para diagramas de secuencia, incluyendo los bloques de activación temporal.

### 6. `UmlPackageNodeComponent` (`<app-uml-package-node>`)
- Renderiza la carpeta UML clásica (rectángulo mayor con pestaña superior izquierda pequeña) y soporte como caja de contención de capas.

### 7. `UmlComponentNodeComponent` (`<app-uml-component-node>`)
- Renderiza el rectángulo con las dos pequeñas pestañas sobresalientes en el borde izquierdo según la especificación UML 2.5.

### 8. `UmlDeploymentNodeComponent` (`<app-uml-deployment-node>`)
- Renderiza nodos en perspectiva 3D isométrica para dispositivos (`<<device>>`), servidores físicos y entornos de ejecución (`<<executionEnvironment>>`).

---

## 3. Conexiones y Puertos (@foblex/flow)

- **Conectores (`f-connection`)**:
  - Cada conexión une un puerto de salida (`fConnectortype="output"`) con uno de entrada (`fConnectortype="input"`).
  - Las flechas y puntas se dibujan mediante marcadores SVG:
    - Herencia / Generalización: Triángulo blanco cerrado.
    - Composición: Rombo negro relleno.
    - Agregación: Rombo blanco hueco.
    - Asociación / Dependencia: Flecha abierta o línea discontinua con etiqueta `<<include>>` / `<<extend>>`.
