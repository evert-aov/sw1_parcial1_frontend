import { Component, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { UserGuideService } from '../../services/user-guide.service';
import {
  heroAcademicCap,
  heroBookOpen,
  heroChatBubbleLeftRight,
  heroCommandLine,
  heroDevicePhoneMobile,
  heroLightBulb,
  heroQuestionMarkCircle,
  heroServerStack,
  heroSparkles,
  heroXMark,
  heroChevronDown,
  heroChevronUp,
  heroArrowsPointingOut,
  heroArrowsPointingIn,
  heroArrowPath,
  heroClipboardDocument,
  heroClipboardDocumentCheck,
  heroPlay,
  heroArrowRight,
  heroArrowLeft,
  heroCheck,
  heroPaperAirplane,
} from '@ng-icons/heroicons/outline';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  codeSnippet?: string;
  codeLanguage?: string;
  quickActions?: { label: string; query: string }[];
}

export interface TourStep {
  title: string;
  badge: string;
  description: string;
  details: string[];
  code?: string;
  tips: string;
}

@Component({
  selector: 'app-user-guide-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  templateUrl: './user-guide-chatbot.component.html',
  styleUrl: './user-guide-chatbot.component.css',
  providers: [
    provideIcons({
      heroAcademicCap,
      heroBookOpen,
      heroChatBubbleLeftRight,
      heroCommandLine,
      heroDevicePhoneMobile,
      heroLightBulb,
      heroQuestionMarkCircle,
      heroServerStack,
      heroSparkles,
      heroXMark,
      heroChevronDown,
      heroChevronUp,
      heroArrowsPointingOut,
      heroArrowsPointingIn,
      heroArrowPath,
      heroClipboardDocument,
      heroClipboardDocumentCheck,
      heroPlay,
      heroArrowRight,
      heroArrowLeft,
      heroCheck,
      heroPaperAirplane,
    }),
  ],
})
export class UserGuideChatbotComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  guideService = inject(UserGuideService);

  // Estado del widget
  get isOpen() {
    return this.guideService.isOpen;
  }
  isExpanded = signal<boolean>(false);
  isTyping = signal<boolean>(false);
  copiedCodeId = signal<string | null>(null);

  // Modo Tour Interactivo
  isTourActive = signal<boolean>(false);
  currentTourStepIndex = signal<number>(0);

  // Input del usuario
  userInput = signal<string>('');

  // Historial de mensajes
  messages = signal<ChatMessage[]>([]);

  // Pasos del Tour Guiado
  readonly tourSteps: TourStep[] = [
    {
      title: '1. Crear y Configurar tu Proyecto',
      badge: 'Paso 1 de 7',
      description: 'El punto de partida es definir tu proyecto de software en el Dashboard.',
      details: [
        'Ve a la pantalla principal de "Proyectos" y haz clic en "+ Nuevo Proyecto".',
        'Ingresa el nombre del sistema (ej: "Sistema de Ventas").',
        'Define el paquete base Java (ej: "com.uagrm.studio").',
        'Selecciona la versión de Java (Java 21 LTS recomendada) y Spring Boot (3.4.0).',
        '¡Listo! Tu proyecto creará un diagrama principal listo para modelar.',
      ],
      tips: '💡 El paquete base configurado aquí determinará la estructura de carpetas de tu backend en Spring Boot.',
    },
    {
      title: '2. Modelar Clases y Atributos UML',
      badge: 'Paso 2 de 7',
      description: 'Construye tu modelo entidad-relación de forma visual e intuitiva.',
      details: [
        'Abre el Toolbox lateral izquierdo y haz clic en "+ Clase" o haz doble clic en el lienzo.',
        'Haz clic en la clase para abrir el panel de edición.',
        'Agrega atributos indicando visibilidad (+ público, - privado, # protegido).',
        'Selecciona el tipo de dato: String, Long/Integer, UUID, Double, Boolean, LocalDate, LocalDateTime.',
        'Marca los modificadores necesarios: PK (Clave Primaria), AutoIncrement, Nullable o Unique.',
        'Agrega métodos con tipos de retorno y parámetros tipados si tu lógica lo requiere.',
      ],
      tips: '💡 Si defines un atributo como PK de tipo Long, el generador configurará automáticamente una secuencia numérica autoincrementable (BIGSERIAL).',
    },
    {
      title: '3. Conectar Relaciones y Multiplicidades',
      badge: 'Paso 3 de 7',
      description: 'Define la integridad referencial y las asociaciones de tu base de datos.',
      details: [
        'En el Toolbox lateral izquierdo, selecciona el tipo de relación: Asociación, Agregación, Composición, Herencia o Realización.',
        'Haz clic primero en la clase origen y luego en la clase destino.',
        'Configura las multiplicidades en los extremos (1..1, 1..*, 0..*).',
        'Por ejemplo, para "Venta" y "Cliente": una Venta tiene 1 Cliente (1..1) y un Cliente tiene muchas Ventas (1..* o 0..*).',
        'El generador creará automáticamente las anotaciones JPA (@ManyToOne, @OneToMany) y las claves foráneas en Flyway.',
      ],
      tips: '💡 Para cambiar entre el modo de puntero/selección y el modo de conexión, presiona la tecla Escape o el icono de cursor en el Toolbox.',
    },
    {
      title: '4. Colaboración en Tiempo Real',
      badge: 'Paso 4 de 7',
      description: 'Trabaja concurrentemente con tu equipo sin pisar cambios ajenos.',
      details: [
        'En la tarjeta del proyecto en el Dashboard, haz clic en "Miembros".',
        'Invita a tus compañeros mediante su correo electrónico y asígnales rol: OWNER, EDITOR o VIEWER.',
        'Al entrar al diagrama verán los cursores de cada usuario con su color en vivo.',
        'Sistema de Bloqueo Exclusivo (NodeLock): Cuando un usuario edita una clase, esta se bloquea temporalmente para los demás, evitando conflictos.',
        'Usa el chat integrado en vivo de la sala para coordinar el trabajo en equipo.',
      ],
      tips: '💡 Los usuarios con rol VIEWER pueden inspeccionar el diagrama y generar código, pero no pueden mutar el modelo.',
    },
    {
      title: '5. Copilot de IA & Visión Multimodal',
      badge: 'Paso 5 de 7',
      description: 'Modifica diagramas en caliente usando Inteligencia Artificial.',
      details: [
        'Abre el panel derecho de "Copilot IA" en el editor.',
        'Modo Texto: Escribe instrucciones como "Crea una entidad Producto con precio, stock y categoría" o "Conecta Producto con DetalleVenta en relación 1 a N".',
        'Modo Visión / Cámara: Sube un boceto dibujado a mano en papel o usa tu cámara web.',
        'La IA analizará el boceto y construirá las clases y conexiones directamente sobre el lienzo.',
      ],
      tips: '💡 Puedes pedirle a la IA tanto crear clases nuevas como refactorizar entidades existentes.',
    },
    {
      title: '6. Generar Código Fullstack (Spring Boot & Flutter)',
      badge: 'Paso 6 de 7',
      description: 'Transforma tu diagrama visual en software de producción listo para ejecutar.',
      details: [
        'En la barra superior del editor, haz clic en "Generador".',
        'Alterna entre las pestañas "Spring Boot" y "Flutter" para previsualizar el código fuente en tiempo real.',
        'Backend generado: Spring Boot 3 con Arquitectura en Capas (Entities JPA, DTOs, Mappers, Repositorios, Servicios, Controladores REST, JWT Auth, Scripts de migración Flyway y Docker Compose).',
        'Móvil generado: Flutter con Clean Architecture (BLoC, DataSources, Repositorios, Entidades, Pantallas CRUD completas, Autenticación JWT y Asistente IA Local).',
        'Haz clic en "Descargar ZIP" para obtener el proyecto empaquetado.',
      ],
      tips: '💡 El backend incluye soporte nativo para PostgreSQL en Docker y autenticación con contraseñas encriptadas con BCrypt.',
    },
    {
      title: '7. Puesta en Marcha en tu Máquina',
      badge: 'Paso 7 de 7',
      description: 'Ejecuta el backend y la app móvil descargados en 3 simples pasos.',
      details: [
        '1. Descomprime el ZIP y abre una terminal en la carpeta /backend.',
        '2. Inicia la base de datos PostgreSQL con Docker Compose.',
        '3. Ejecuta el backend Spring Boot con Gradle.',
        '4. En otra terminal en /mobile_flutter, ejecuta la app en tu móvil o emulador.',
        'Credenciales de Administrador por defecto: admin@studio.com / admin123.',
      ],
      code: `# 1. Levantar base de datos PostgreSQL
docker compose -f docker-compose.local.yml up -d db

# 2. Ejecutar backend Spring Boot
gradle bootRun

# 3. En otra terminal, ejecutar App Móvil Flutter
cd ../mobile_flutter
flutter run`,
      tips: '💡 Si quieres reiniciar la base de datos desde cero, usa: docker compose -f docker-compose.local.yml down -v',
    },
  ];

  // Píldoras de sugerencias rápidas
  readonly quickPills = [
    { label: '🚀 Guía Rápida (Paso a Paso)', query: 'iniciar tour' },
    { label: '🐳 ¿Cómo correr con Docker y Gradle?', query: 'comandos de ejecucion' },
    { label: '⚡ ¿Cómo generar Spring Boot y Flutter?', query: 'como generar codigo' },
    { label: '🎨 ¿Cómo crear clases y relaciones?', query: 'como modelar clases y relaciones' },
    { label: '📱 ¿Cómo funciona la IA Local en el móvil?', query: 'ia en flutter y pocketpal' },
    { label: '👥 ¿Cómo colaborar en equipo?', query: 'colaboracion en tiempo real' },
    { label: '🔄 ¿Cómo importar/exportar a Enterprise Architect?', query: 'enterprise architect xmi' },
  ];

  constructor() {
    this.initWelcomeMessage();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (_) {}
  }

  initWelcomeMessage(): void {
    this.messages.set([
      {
        id: 'welcome-1',
        sender: 'bot',
        text: '¡Hola! 👋 Soy tu **Asistente y Guía Interactivo de UML Architect & Code Generator**.\n\nHe reemplazado los manuales de usuario estáticos para ayudarte paso a paso en tiempo real. Puedes preguntarme cualquier duda sobre cómo usar la plataforma, modelar diagramas, generar código o ejecutar tus proyectos.',
        timestamp: new Date(),
        quickActions: [
          { label: '🚀 Iniciar Tour Guiado Paso a Paso', query: 'iniciar tour' },
          { label: '🐳 Comandos para Correr el Proyecto', query: 'comandos de ejecucion' },
          { label: '⚡ ¿Qué genera la plataforma?', query: 'arquitectura generada' },
        ],
      },
    ]);
  }

  toggleOpen(): void {
    this.guideService.toggleGuide();
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  resetChat(): void {
    this.isTourActive.set(false);
    this.currentTourStepIndex.set(0);
    this.initWelcomeMessage();
  }

  copyCode(code: string, id: string): void {
    navigator.clipboard.writeText(code);
    this.copiedCodeId.set(id);
    setTimeout(() => {
      this.copiedCodeId.set(null);
    }, 2000);
  }

  // ==================== LÓGICA DEL TOUR GUIADO ====================

  startTour(): void {
    this.isTourActive.set(true);
    this.currentTourStepIndex.set(0);
    this.sendTourStepMessage(0);
  }

  nextTourStep(): void {
    const nextIdx = this.currentTourStepIndex() + 1;
    if (nextIdx < this.tourSteps.length) {
      this.currentTourStepIndex.set(nextIdx);
      this.sendTourStepMessage(nextIdx);
    } else {
      this.finishTour();
    }
  }

  prevTourStep(): void {
    const prevIdx = this.currentTourStepIndex() - 1;
    if (prevIdx >= 0) {
      this.currentTourStepIndex.set(prevIdx);
      this.sendTourStepMessage(prevIdx);
    }
  }

  goToTourStep(index: number): void {
    if (index >= 0 && index < this.tourSteps.length) {
      this.currentTourStepIndex.set(index);
      this.sendTourStepMessage(index);
    }
  }

  finishTour(): void {
    this.isTourActive.set(false);
    this.addBotMessage(
      '🎉 **¡Felicidades! Has completado el Tour Interactivo de UML Architect.**\n\nYa conoces todo el flujo: desde crear tu proyecto hasta modelar en el lienzo, generar código Fullstack y poner en marcha el backend y la app móvil.\n\n¿Tienes alguna duda específica? Escríbela en el chat y con gusto te respondo.',
      undefined,
      undefined,
      [
        { label: '🐳 Ver comandos Docker & Gradle', query: 'comandos de ejecucion' },
        { label: '📱 Ver integración con PocketPal IA', query: 'ia en flutter y pocketpal' },
        { label: '🔄 Reiniciar Tour', query: 'iniciar tour' },
      ],
    );
  }

  private sendTourStepMessage(index: number): void {
    const step = this.tourSteps[index];
    const detailsFormatted = step.details.map((d) => `• ${d}`).join('\n');
    const text = `### 📘 ${step.title} (${step.badge})\n\n${step.description}\n\n${detailsFormatted}\n\n${step.tips}`;

    this.addBotMessage(text, step.code, 'bash');
  }

  // ==================== PROCESAMIENTO CONVERSACIONAL ====================

  sendMessage(textToSend?: string): void {
    const query = (textToSend ?? this.userInput()).trim();
    if (!query) return;

    // Agregar mensaje del usuario
    this.messages.update((msgs) => [
      ...msgs,
      {
        id: 'user-' + Date.now(),
        sender: 'user',
        text: query,
        timestamp: new Date(),
      },
    ]);

    if (!textToSend) {
      this.userInput.set('');
    }

    // Simular escritura interactiva del bot
    this.isTyping.set(true);
    setTimeout(() => {
      this.resolveUserQuery(query);
      this.isTyping.set(false);
    }, 450);
  }

  private addBotMessage(
    text: string,
    codeSnippet?: string,
    codeLanguage?: string,
    quickActions?: { label: string; query: string }[],
  ): void {
    this.messages.update((msgs) => [
      ...msgs,
      {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text,
        timestamp: new Date(),
        codeSnippet,
        codeLanguage,
        quickActions,
      },
    ]);
  }

  private resolveUserQuery(rawInput: string): void {
    const text = rawInput.toLowerCase().trim();

    // 1. Iniciar o navegar en el tour
    if (
      text.includes('iniciar tour') ||
      text.includes('comenzar tour') ||
      text.includes('tour') ||
      text.includes('empezar') ||
      text.includes('tutorial') ||
      text.includes('paso a paso')
    ) {
      this.startTour();
      return;
    }

    // 2. Comandos de Ejecución (Docker, Gradle, PostgreSQL, Flutter)
    if (
      text.includes('docker') ||
      text.includes('gradle') ||
      text.includes('bootrun') ||
      text.includes('comando') ||
      text.includes('ejecut') ||
      text.includes('correr') ||
      text.includes('compil') ||
      text.includes('levantar') ||
      text.includes('arrancar')
    ) {
      this.addBotMessage(
        '### 🚀 Comandos para Ejecutar el Proyecto Descargado\n\nPara poner en marcha el proyecto generado en tu máquina local, sigue estos sencillos pasos desde tu terminal:\n\n**1. Iniciar la Base de Datos PostgreSQL:**\nDentro de la carpeta `/backend`, ejecuta Docker Compose en segundo plano.\n\n**2. Compilar y Ejecutar el Backend (Spring Boot 3):**\nEjecuta Gradle. Flyway aplicará automáticamente las migraciones y creará el usuario administrador por defecto (`admin@studio.com` / `admin123`).\n\n**3. Ejecutar la App Móvil (Flutter):**\nEn otra terminal, entra a `/mobile_flutter` y corre la aplicación en tu dispositivo o emulador.',
        `# === PASO 1: Levantar PostgreSQL en Docker (puerto 5431/5432) ===
cd backend
docker compose -f docker-compose.local.yml up -d db

# === PASO 2: Iniciar servidor Spring Boot 3 ===
gradle bootRun

# === PASO 3 (Opcional): Ejecutar App Móvil Flutter ===
cd ../mobile_flutter
flutter run`,
        'bash',
        [
          { label: '🔑 ¿Cuáles son las credenciales por defecto?', query: 'credenciales por defecto' },
          { label: '📱 ¿Cómo usar la IA con PocketPal?', query: 'ia en flutter y pocketpal' },
          { label: '⚡ ¿Cómo generar el código?', query: 'como generar codigo' },
        ],
      );
      return;
    }

    // 3. Credenciales y Autenticación
    if (
      text.includes('credencial') ||
      text.includes('admin') ||
      text.includes('usuario') ||
      text.includes('password') ||
      text.includes('login') ||
      text.includes('contraseña') ||
      text.includes('clave')
    ) {
      this.addBotMessage(
        '### 🔑 Credenciales de Acceso por Defecto\n\nEl sistema inicializa automáticamente un usuario con rol de Administrador en la base de datos (con contraseña encriptada en BCrypt):\n\n• **Correo electrónico:** `admin@studio.com`\n• **Contraseña:** `admin123`\n• **Rol:** `ADMIN`\n\n**¿Cómo funciona la autenticación?**\n• El backend expone endpoints `/api/auth/login` y `/api/auth/register` protegidos con **JWT Token (Bearer)**.\n• La app móvil Flutter almacena de forma segura el token y los datos del perfil en local (`TokenStorageService`) y muestra el usuario conectado en la pantalla de **Mi Perfil**.',
        undefined,
        undefined,
        [
          { label: '🐳 Ver comandos para correr el backend', query: 'comandos de ejecucion' },
          { label: '📱 Ver funciones de la app móvil', query: 'ia en flutter y pocketpal' },
        ],
      );
      return;
    }

    // 4. Generación de Código
    if (
      text.includes('generar') ||
      text.includes('codigo') ||
      text.includes('código') ||
      text.includes('spring') ||
      text.includes('descargar') ||
      text.includes('zip') ||
      text.includes('export')
    ) {
      this.addBotMessage(
        '### ⚡ Generador de Código Fullstack Automatizado\n\nUML Architect compila tu diagrama visual en código limpio listo para producción:\n\n**1. Backend (Spring Boot 3 + PostgreSQL):**\n• **Controladores REST** tipados con Swagger/OpenAPI y DTOs de petición y respuesta.\n• **Servicios y Lógica de Negocio** desacoplada con Mappers.\n• **Repositorios Spring Data JPA** y Entidades con relaciones tipadas.\n• **Migraciones Flyway (SQL)** con soporte de UUID nativo (`pgcrypto`) y secuencias numéricas (`BIGSERIAL`).\n• **Seguridad JWT** con BCrypt y filtros de autorización.\n• **Docker Compose** preconfigurado.\n\n**2. Frontend Móvil (Flutter):**\n• **Clean Architecture** estructurada en Capas (Data, Domain, Presentation).\n• **Gestión de Estado BLoC** reactiva.\n• **Pantallas CRUD completas** con validaciones y tarjetas interactivas.\n• **Asistente IA Local** con soporte híbrido de PocketPal AI y motor semántico On-Device.\n\n**¿Cómo descargarlo?**\nEn la barra superior del editor, haz clic en el botón **"Generador"** y presiona **"Descargar ZIP"**.',
        undefined,
        undefined,
        [
          { label: '🐳 ¿Cómo ejecuto el ZIP descargado?', query: 'comandos de ejecucion' },
          { label: '🎨 ¿Cómo creo clases en el lienzo?', query: 'como modelar clases y relaciones' },
        ],
      );
      return;
    }

    // 5. Inteligencia Artificial en el Móvil y PocketPal
    if (
      text.includes('pocketpal') ||
      text.includes('flutter') ||
      text.includes('movil') ||
      text.includes('móvil') ||
      text.includes('ia local') ||
      text.includes('gemma') ||
      text.includes('qwen') ||
      text.includes('voz') ||
      text.includes('microfono') ||
      text.includes('audio')
    ) {
      this.addBotMessage(
        '### 📱 Inteligencia Artificial Híbrida en la App Móvil\n\nLa app móvil Flutter incluye un asistente inteligente con **arquitectura híbrida de doble motor**:\n\n**1. Motor 1: Conexión con PocketPal AI (Local Server)**\n• Si tienes instalada la app **PocketPal** en tu móvil, activa la opción de servidor local.\n• PocketPal expone un servidor HTTP en `http://127.0.0.1:8080` con tus modelos locales (Gemma 3, Qwen 2.5, Bonsai, etc.).\n• En el asistente de la app Flutter, pulsa el icono de **Ajustes** y selecciona el chip preconfigurado `📱 PocketPal (Móvil)`.\n\n**2. Motor 2: Procesador Semántico On-Device (100% Autónomo)**\n• Si PocketPal está cerrado o no quieres consumir memoria en un modelo pesado, la app activa automáticamente el motor semántico nativo.\n• Entiende órdenes en lenguaje natural para todo el ciclo CRUD:\n  - *"regístrame un usuario con nombre Ana, email ana@gmail.com, password 123"*\n  - *"actualiza el cliente 2 cambiando el teléfono a 77889900"*\n  - *"elimina la compra con id 5"*\n  - *"lista las ventas"*\n\n**3. Dictado por Voz:**\n• Pulsa el botón del micrófono y habla en español para enviar tus comandos sin teclear.',
        undefined,
        undefined,
        [
          { label: '🐳 Ver comandos para correr el backend', query: 'comandos de ejecucion' },
          { label: '🔑 Ver credenciales de administrador', query: 'credenciales por defecto' },
        ],
      );
      return;
    }

    // 6. Modelado UML: Clases, Atributos y Métodos
    if (
      text.includes('clase') ||
      text.includes('atributo') ||
      text.includes('metodo') ||
      text.includes('método') ||
      text.includes('pk') ||
      text.includes('clave primaria') ||
      text.includes('tipo') ||
      text.includes('dato')
    ) {
      this.addBotMessage(
        '### 🎨 Modelado de Clases y Atributos UML\n\n**¿Cómo agregar una clase?**\n• Haz clic en el botón `+ Clase` del Toolbox lateral izquierdo o haz doble clic en cualquier área vacía del lienzo.\n\n**Tipos de datos soportados por el generador:**\n• `String`: Textos, nombres, correos, descripciones (`VARCHAR(255)` / `TEXT`).\n• `Long` / `Integer`: Números enteros, cantidades, identificadores numéricos (`BIGINT` / `INTEGER`).\n• `UUID`: Identificadores únicos universales (`UUID` con generación nativa en PostgreSQL).\n• `Double` / `BigDecimal`: Montos, precios, subtotales, totales con decimales.\n• `Boolean`: Banderas lógicas (`true` / `false`).\n• `LocalDate` / `LocalDateTime`: Fechas y marcas de tiempo (`DATE` / `TIMESTAMP`).\n\n**Modificadores:**\n• **PK:** Define la clave primaria.\n• **AutoIncrement:** Habilita secuencias automáticas en base de datos (`BIGSERIAL`).\n• **Unique:** Asegura que no existan valores duplicados (ej: emails, números de factura, NIT).\n• **Nullable:** Permite que el campo acepte nulos.',
        undefined,
        undefined,
        [
          { label: '🔗 ¿Cómo conecto relaciones entre clases?', query: 'como conectar relaciones' },
          { label: '⚡ Generar código Spring Boot', query: 'como generar codigo' },
        ],
      );
      return;
    }

    // 7. Relaciones y Multiplicidades
    if (
      text.includes('relacion') ||
      text.includes('relación') ||
      text.includes('conectar') ||
      text.includes('multiplicidad') ||
      text.includes('asociacion') ||
      text.includes('asociación') ||
      text.includes('composicion') ||
      text.includes('composición') ||
      text.includes('agregacion') ||
      text.includes('agregación') ||
      text.includes('herencia') ||
      text.includes('foreign key') ||
      text.includes('fk')
    ) {
      this.addBotMessage(
        '### 🔗 Conexión de Relaciones y Multiplicidades\n\n**Pasos para conectar dos clases:**\n1. En el Toolbox lateral izquierdo, haz clic sobre el tipo de relación que deseas crear (Asociación, Agregación, Composición, Herencia o Realización).\n2. El cursor se activará en modo de conexión.\n3. Haz clic en la **Clase Origen** (ej: `Venta`).\n4. Haz clic en la **Clase Destino** (ej: `Cliente`).\n5. Se creará el enlace visual en el lienzo.\n\n**Tipos de Relaciones Semánticas:**\n• **Asociación Simple:** Conexión estándar entre dos entidades.\n• **Agregación (Rombo hueco):** Relación "todo-parte" donde las partes pueden existir independientemente.\n• **Composición (Rombo relleno):** Relación fuerte de pertenencia de ciclo de vida (ej: `Venta` y `DetalleVenta`).\n• **Herencia / Generalización (Flecha triangular hueca):** Define subclases y superclases.\n\n**Multiplicidades:**\n• Puedes asignar `1..1`, `0..1`, `1..*` o `*` en cada extremo. El generador traducirá esto a `@ManyToOne`, `@OneToMany` o `@OneToOne` en Spring Boot y las claves foráneas correspondientes en PostgreSQL.',
        undefined,
        undefined,
        [
          { label: '🎨 ¿Cómo crear atributos y clases?', query: 'como modelar clases y atributos' },
          { label: '⚡ ¿Cómo generar código?', query: 'como generar codigo' },
        ],
      );
      return;
    }

    // 8. Colaboración en Vivo
    if (
      text.includes('colabora') ||
      text.includes('equipo') ||
      text.includes('miembro') ||
      text.includes('invitar') ||
      text.includes('tiempo real') ||
      text.includes('bloqueo') ||
      text.includes('nodelock') ||
      text.includes('socket')
    ) {
      this.addBotMessage(
        '### 👥 Colaboración Multiusuario en Tiempo Real\n\nUML Architect permite que múltiples desarrolladores trabajen en el mismo diagrama simultáneamente mediante **WebSockets (Socket.io)**:\n\n**1. Invitar Miembros:**\n• En el Dashboard de Proyectos, haz clic en el botón **"Miembros"** de la tarjeta del proyecto.\n• Ingresa el correo de tu colega y asígnale un rol:\n  - **OWNER:** Propietario del proyecto con control total.\n  - **EDITOR:** Puede crear, modificar y eliminar clases y relaciones en tiempo real.\n  - **VIEWER:** Solo lectura (puede explorar el lienzo y generar código).\n\n**2. Cursores Remotos:**\n• Verás los cursores de tus compañeros moviéndose por el lienzo en tiempo real con su nombre y color.\n\n**3. Bloqueo de Nodos (NodeLock):**\n• Cuando alguien abre para editar una clase, el sistema bloquea temporalmente esa entidad para los demás evitando sobreescrituras accidentales.',
        undefined,
        undefined,
        [
          { label: '🚀 Iniciar Tour Guiado', query: 'iniciar tour' },
          { label: '⚡ Generar código del diagrama', query: 'como generar codigo' },
        ],
      );
      return;
    }

    // 9. Enterprise Architect XMI
    if (
      text.includes('xmi') ||
      text.includes('enterprise architect') ||
      text.includes('ea') ||
      text.includes('importar')
    ) {
      this.addBotMessage(
        '### 🔄 Interoperabilidad con Enterprise Architect (XMI 2.1)\n\nEl sistema cuenta con compatibilidad bidireccional completa con **Enterprise Architect**:\n\n**1. Exportar a Enterprise Architect:**\n• En la barra superior, haz clic en **"Exportar"** y selecciona **"Enterprise Architect (.xmi)"**.\n• Genera un archivo estándar XMI 2.1 con diagramas, clases, atributos, visibilidades y relaciones reconocibles por Sparx Systems Enterprise Architect.\n\n**2. Importar desde Enterprise Architect:**\n• En la barra superior, selecciona **"Importar XMI"** y sube tu archivo `.xmi`.\n• El conversor transformará automáticamente los elementos XMI en nodos y conexiones interactivas en el lienzo web.\n\n**3. Historial de Versiones:**\n• Puedes guardar snapshots del diagrama y restaurar versiones anteriores en cualquier momento.',
        undefined,
        undefined,
        [
          { label: '⚡ Generar código Spring Boot', query: 'como generar codigo' },
          { label: '🚀 Ver Tour Guiado', query: 'iniciar tour' },
        ],
      );
      return;
    }

    // 10. Copilot de IA en el Lienzo Web
    if (
      text.includes('copilot') ||
      text.includes('asistente') ||
      text.includes('gemini') ||
      text.includes('camara') ||
      text.includes('cámara') ||
      text.includes('foto') ||
      text.includes('boceto')
    ) {
      this.addBotMessage(
        '### 🤖 Copilot de Inteligencia Artificial en el Lienzo\n\nEn la esquina superior derecha del editor, haz clic en el botón flotante **"Copilot IA"**:\n\n• **Comandos en Lenguaje Natural:**\n  Escribe en español lo que deseas en el diagrama. Ejemplo:\n  *"Crea un módulo de compras con Proveedor, Compra y DetalleCompra con sus relaciones"*\n\n• **Entrada Visual Multimodal (Cámara o Foto):**\n  ¿Tienes un diagrama dibujado en una pizarra o en una hoja de papel? Sube la foto o activa tu cámara web. La IA interpretará los rectángulos, textos y flechas y colocará las clases y relaciones directamente en el lienzo.',
        undefined,
        undefined,
        [
          { label: '🎨 ¿Cómo editar clases manualmente?', query: 'como modelar clases y atributos' },
          { label: '⚡ Generar código del diagrama', query: 'como generar codigo' },
        ],
      );
      return;
    }

    // 11. Respuesta por Defecto (Fallback Inteligente con Recomendaciones)
    this.addBotMessage(
      `Entiendo tu consulta sobre: "${rawInput}".\n\nAquí tienes los temas principales del **Manual Interactivo** para ayudarte de inmediato. Selecciona cualquiera de las opciones rápidas:`,
      undefined,
      undefined,
      [
        { label: '🚀 Iniciar Tour Guiado Paso a Paso', query: 'iniciar tour' },
        { label: '🐳 Comandos para Correr Docker y Gradle', query: 'comandos de ejecucion' },
        { label: '⚡ Generar Código Spring Boot y Flutter', query: 'como generar codigo' },
        { label: '📱 App Móvil y PocketPal IA', query: 'ia en flutter y pocketpal' },
        { label: '🎨 Crear Clases y Relaciones UML', query: 'como modelar clases y relaciones' },
      ],
    );
  }
}
