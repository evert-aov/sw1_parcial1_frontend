# 03 - Lienzo y Nodos Modulares (Konva.js 2D Canvas Engine)

## 1. Visión General del Lienzo
El lienzo de dibujo está implementado en [`DiagramCanvasComponent`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/diagram-canvas.component.ts) y utiliza el motor gráfico de alto rendimiento **Konva.js**.

El lienzo Konva se encarga de:
1. **Lienzo Multi-Capa Optimizado**:
   - `bgLayer`: Grilla infinita paramétrica y fondo interactivo.
   - `relLayer`: Capa independiente para renderizado de relaciones con animación progresiva a 60 FPS.
   - `nodeLayer`: Capa de nodos UML interactivos y arrastrables.
   - `uiLayer`: Transformer de redimensionamiento fluido, guías de alineación y previsualización de conexiones en vivo.
2. **Cámara y Viewport**:
   - Paneo espacial infinito y zoom fluido mediante rueda de ratón centrado en la posición del cursor.
3. **Animación y Flujo Direccional**:
   - Motor de revelado progresivo de líneas con cabeza trazadora brillante (`tracerHead`).
   - Pulso direccional animado sobre relaciones activas (`flowOverlay`).

---

## 2. Los 13 Nodos Modulares en `diagram-canvas/konva/nodes/`

Cada nodo del editor ha sido implementado como un renderer modular independiente en [`frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/konva/nodes/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/konva/nodes/):

```
konva/nodes/
├── class.node.ts          # Clases UML estándar con cálculo automático de límites sin recorte
├── actor.node.ts          # Actores humanos UML (stickman vectorial con proporciones canónicas)
├── use_case.node.ts       # Casos de Uso (óvalos de negocio con tipografía centrada)
├── boundary.node.ts       # Análisis de Robustez BCE (Boundary - interfaz de usuario/API)
├── control.node.ts        # Análisis de Robustez BCE (Control - controlador o servicio)
├── entity.node.ts         # Análisis de Robustez BCE (Entity - modelo persistente)
├── lifeline.node.ts       # Líneas de vida temporales para Secuencia con cajas de activación
├── deployment.node.ts     # Nodos 3D isométricos de despliegue (Dispositivos, Servidores, Entornos)
├── component.node.ts      # Componentes modulares con icono UML 2.5 y puertos sobresalientes
├── package.node.ts        # Paquetes UML con pestaña superior de carpeta y cuerpo contenedor
├── package_layer.node.ts  # Capas arquitectónicas contenedoras (Presentación, Negocio, Datos)
├── activity.node.ts       # Diagrama de Actividad (Initial, Final bullseye, Action, Decision, Fork)
├── note.node.ts           # Notas UML 2.5 con esquina doblada (dog-ear) y auto-ajuste multilínea
├── uml-relationship.renderer.ts # Motor vectorial completo de relaciones, ensamblajes y mensajes
└── index.ts               # Barrel export de todos los renderers
```

### 1. `class.node.ts`
- Renderiza el rectángulo tripartito estándar de UML 2.5:
  - **Cabecera**: Estereotipo (`«interface»`, `«abstract»`, `«entity»`), nombre de la clase y fondo estilizado.
  - **Compartimento de Atributos**: Visibilidad (`+`, `-`, `#`, `~`), nombre y tipo.
  - **Compartimento de Métodos**: Visibilidad, nombre, parámetros y tipo de retorno.
- Incluye `computeClassAutoBounds` para dimensionamiento dinámico libre de recorte de texto.

### 2. `use_case.node.ts`
- Renderiza el óvalo de caso de uso UML con sombra suave y texto centrado.

### 3. `actor.node.ts`
- Renderiza la figura humana clásica (*stickman*) con cabeza, tronco, brazos y piernas en trazo 2D nítido.

### 4. Nodos de Robustez BCE (`boundary.node.ts`, `control.node.ts`, `entity.node.ts`)
- **Boundary**: Círculo con barra vertical lateral y puente horizontal (`├─◯`).
- **Control**: Círculo con flecha superior orientada hacia la derecha.
- **Entity**: Círculo con línea horizontal de base subrayada.

### 5. `lifeline.node.ts`
- Renderiza la cabecera (participante o actor), la línea discontinua vertical y las cajas de activación temporal.

### 6. `component.node.ts`
- Renderiza el cuerpo principal y el icono de componente UML 2.5 en la esquina superior derecha con sus dos puertos característicos.

### 7. `package.node.ts` y `package_layer.node.ts`
- **Package**: Carpeta con pestaña superior izquierda y cuerpo agrupador.
- **Package Layer**: Contenedor de capa arquitectónica amplia para visualización por niveles.

### 8. `activity.node.ts`
- **Initial**: Círculo negro sólido con etiqueta superior.
- **Final**: Bullseye con anillo exterior verde suave y núcleo negro.
- **Action**: Rectángulo con esquinas redondeadas y gradiente cálido.
- **Decision**: Rombo con soporte de condición de guardia `[Guard]`.
- **Fork / Join**: Barra horizontal oscura de sincronización y bifurcación concurrente.

### 9. `note.node.ts`
- Rectángulo de nota con esquina superior derecha doblada (*dog-ear flap*), cabecera `«note»` y soporte multilínea.

---

## 3. Conexiones y Relaciones (`uml-relationship.renderer.ts`)

Soporta todas las geometrías de la especificación UML 2.5:
1. **Asociación**: Línea continua directa con etiquetas de multiplicidad en extremos (`sourceMultiplicity`, `targetMultiplicity`).
2. **Generalización**: Flecha cerrada triangular blanca.
3. **Composición**: Rombo relleno oscuro en el extremo de contención fuerte.
4. **Agregación**: Rombo hueco blanco en el extremo de contención débil.
5. **Dependencia / Trazabilidad**: Línea punteada discontinua con flecha abierta `V`.
6. **Ensamble (Assembly)**: Notación socket and ball (`──(◯──`) entre interfaz requerida y provista para componentes.
7. **Flujo de Control**: Flecha abierta con soporte para etiquetas de guarda (`[Guard]`).
8. **Anclaje de Nota**: Línea punteada gris tenue (`┈ ┈`).
9. **Mensajes de Comunicación y Despliegue**: Mensajes apilados bidireccionales con flechas de avance (`→`) superiores y retroceso (`←`) inferiores.
10. **Clase Asociativa (Association Class N:M)**: Conexión intermedia mediante rama punteada (`dashed stem`) que une de manera dinámica y reactiva el punto medio de la línea de asociación con el nodo de la clase intermedia, con punto de anclaje central (`anchor dot`).

---

## 4. Estilos de Línea y Captura Magnética de Proximidad

### Estilos de Línea (UML Line Styles)
El motor de relaciones calcula polilíneas con 10 estilos de enrutamiento:
- `direct` (`straight`): Conexión directa y limpia entre los bordes de los nodos.
- `auto_routing` / `orthogonal_square` (`segment`): Enrutamiento ortogonal con ángulos rectos de 90°.
- `orthogonal_rounded` (`adaptive-curve`): Enrutamiento ortogonal con esquinas redondeadas (radio 14px).
- `bezier`: Curva cúbica suave de Bézier calculada según la orientación dominante.
- `tree_vertical`: Enrutamiento estilo árbol vertical con conexiones en bordes superior/inferior.
- `tree_horizontal`: Enrutamiento estilo árbol horizontal con conexiones en bordes laterales.
- `lateral_vertical`: Enrutamiento lateral vertical en forma de L.
- `lateral_horizontal`: Enrutamiento lateral horizontal en forma de L.
- `custom`: Polilínea guiada por puntos de quiebre (*waypoints*).

### Zona de Captura de 46px y Detección Geométrica de 28px
- **Corredor de captura invisible de 46px (`hitStrokeWidth: 46`)**: Cada relación (incluyendo sus segmentos, mensajes y el stem de clase asociativa) cuenta con una geometría invisible de 46px de ancho para que hacer clic o seleccionar sea sumamente fluido sin necesidad de apuntar al píxel exacto.
- **Detección de proximidad de 28px (`getPointToRelationshipDistance`)**: Al acercar el cursor a menos de 28px de cualquier relación, el lienzo detecta la proximidad geométrica euclidiana, ilumina suavemente el halo de preselección (`.hover-halo`), cambia el cursor a `pointer`, y permite seleccionar o desplegar el menú contextual con un solo clic.

---

## 5. Optimizaciones de Rendimiento y Refinamiento Visual

### Control de Zoom y Rendimiento de Memoria (15% - 125%)
- **Rango acotado**: El factor de escala del lienzo está estrictamente delimitado entre `0.15` (15%) y `1.25` (125%). Esto garantiza máxima nitidez visual sin disparar el consumo de memoria RAM o degradar el rendimiento de renderizado en navegadores cuando se realizan transiciones graduales de zoom.
- **Redibujado selectivo**: Se optimizan los ciclos de actualización evitando reconstrucciones completas de capas Konva cuando el zoom o paneo permanece dentro del umbral de tolerancia.

### Clases Asociativas Refinadas
- **Sin estereotipo redundante**: Las clases asociativas se muestran limpias sin la cabecera `«association_class»`, conforme a las directivas de diseño visual.
- **Espaciado simétrico**: Cálculo balanceado del padding izquierdo y derecho en la lista de atributos (`| + atributo: tipo |`), eliminando espacios vacíos desproporcionados a la derecha.
- **Estabilidad de animación**: Las animaciones de flujo en las conexiones no se reinician de manera disruptiva al actualizar atributos de un nodo.

### Personalización de Color de Nodos con Persistencia en Backend
- La cinta de herramientas superior permite elegir la paleta cromática para cualquier nodo seleccionado.
- El color se almacena en el modelo de datos (`customColor`), se transmite vía WebSockets a colaboradores concurrentes y se persiste en PostgreSQL a través del backend.
