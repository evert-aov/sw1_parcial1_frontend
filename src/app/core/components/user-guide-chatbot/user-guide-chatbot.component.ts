import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { UserGuideService } from '../../services/user-guide.service';
import { TranslationService, TranslatePipe } from '../../i18n';
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
  heroChevronLeft,
  heroChevronRight,
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
  heroEye,
  heroEyeSlash,
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
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
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
      heroChevronLeft,
      heroChevronRight,
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
      heroEye,
      heroEyeSlash,
    }),
  ],
})
export class UserGuideChatbotComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('pillsContainer') private pillsContainer!: ElementRef;

  guideService = inject(UserGuideService);
  translationService = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly initialTimestamp = new Date();

  // Posición arrastrable (Draggable) del icono del manual
  readonly launcherPosX = signal<number | null>(null);
  readonly launcherPosY = signal<number | null>(null);
  readonly isDragging = signal<boolean>(false);

  private dragStartX = 0;
  private dragStartY = 0;
  private initialPosX = 0;
  private initialPosY = 0;
  private hasMoved = false;

  constructor() {
    try {
      const savedPos = localStorage.getItem('user_guide_launcher_pos');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.max(10, Math.min(window.innerWidth - 65, parsed.x));
          const clampedY = Math.max(10, Math.min(window.innerHeight - 65, parsed.y));
          this.launcherPosX.set(clampedX);
          this.launcherPosY.set(clampedY);
        }
      }
    } catch {}
  }

  onLauncherMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.startDrag(event.clientX, event.clientY, event.currentTarget as HTMLElement);
  }

  onLauncherTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    this.startDrag(event.touches[0].clientX, event.touches[0].clientY, event.currentTarget as HTMLElement);
  }

  private startDrag(clientX: number, clientY: number, target: HTMLElement): void {
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    const rect = target.getBoundingClientRect();
    this.initialPosX = rect.left;
    this.initialPosY = rect.top;
    this.hasMoved = false;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = currX - this.dragStartX;
      const deltaY = currY - this.dragStartY;
      if (Math.hypot(deltaX, deltaY) > 5) {
        this.hasMoved = true;
        this.isDragging.set(true);
      }
      if (this.hasMoved) {
        const newX = Math.max(10, Math.min(window.innerWidth - 65, this.initialPosX + deltaX));
        const newY = Math.max(10, Math.min(window.innerHeight - 65, this.initialPosY + deltaY));
        this.launcherPosX.set(newX);
        this.launcherPosY.set(newY);
      }
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);

      if (this.hasMoved) {
        try {
          localStorage.setItem(
            'user_guide_launcher_pos',
            JSON.stringify({ x: this.launcherPosX(), y: this.launcherPosY() })
          );
        } catch {}
      }

      setTimeout(() => {
        this.isDragging.set(false);
        this.hasMoved = false;
      }, 80);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  onLauncherClick(): void {
    if (this.hasMoved || this.isDragging()) return;
    this.toggleOpen();
  }

  hideLauncher(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.guideService.hideLauncher();
  }

  showLauncher(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.guideService.showLauncher();
  }

  scrollPills(offset: number): void {
    if (this.pillsContainer) {
      this.pillsContainer.nativeElement.scrollBy({
        left: offset,
        behavior: 'smooth',
      });
    }
  }

  onPillsWheel(event: WheelEvent): void {
    if (this.pillsContainer && event.deltaY !== 0) {
      event.preventDefault();
      this.pillsContainer.nativeElement.scrollLeft += event.deltaY;
    }
  }

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

  // Mensajes de la conversación (preguntas del usuario, respuestas del bot y pasos del tour)
  conversationMessages = signal<ChatMessage[]>([]);

  // Mensaje de bienvenida reactivo que se adapta instantáneamente al cambiar el idioma
  readonly welcomeMessage = computed<ChatMessage>(() => {
    const isEn = this.translationService.currentLang() === 'en';
    return {
      id: 'welcome-1',
      sender: 'bot',
      text: isEn
        ? 'Hello! 👋 I am your **Interactive Assistant and User Guide for UML Architect & Code Generator**.\n\nI have replaced static user manuals to help you step by step in real time. Feel free to ask any questions about using the platform, modeling diagrams, generating code, or running your projects.'
        : '¡Hola! 👋 Soy tu **Asistente y Guía Interactivo de UML Architect & Code Generator**.\n\nHe reemplazado los manuales de usuario estáticos para ayudarte paso a paso en tiempo real. Puedes preguntarme cualquier duda sobre cómo usar la plataforma, modelar diagramas, generar código o ejecutar tus proyectos.',
      timestamp: this.initialTimestamp,
      quickActions: isEn
        ? [
            { label: '🚀 Start Step-by-Step Tour', query: 'start tour' },
            { label: '📊 Supported Diagram Types', query: 'diagram types' },
            { label: '🐳 Project Run Commands', query: 'run commands' },
            { label: '⚡ What does the platform generate?', query: 'generated architecture' },
          ]
        : [
            { label: '🚀 Iniciar Tour Guiado Paso a Paso', query: 'iniciar tour' },
            { label: '📊 Tipos de Diagramas Soportados', query: 'tipos de diagramas' },
            { label: '🐳 Comandos para Correr el Proyecto', query: 'comandos de ejecucion' },
            { label: '⚡ ¿Qué genera la plataforma?', query: 'arquitectura generada' },
          ],
    };
  });

  // Lista de todos los mensajes visibles en el chat
  readonly messages = computed<ChatMessage[]>(() => {
    return [this.welcomeMessage(), ...this.conversationMessages()];
  });

  // Pasos del Tour Guiado en Español
  readonly tourStepsEs: TourStep[] = [
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
      title: '2. Modelar Diagramas UML y Arquitectónicos',
      badge: 'Paso 2 de 7',
      description: 'Construye tu diseño visual alternando entre 8 tipos de diagramas según tu necesidad.',
      details: [
        'En la barra superior o Toolbox, selecciona el tipo de diagrama: Clases, Casos de Uso, Secuencia, Comunicación, Paquetes, Componentes, Despliegue o Análisis de Clases.',
        'El Toolbox lateral izquierdo adaptará dinámicamente sus herramientas (Actores, Óvalos, Lifelines, Nodos de Frontera/Control/Entidad, Clases).',
        'Haz clic en cualquier herramienta o haz doble clic sobre el lienzo para instanciar elementos.',
        'En Clases: agrega atributos con visibilidad (+, -, #), tipos de datos (String, Long, UUID, Double, LocalDate) y modificadores (PK, AutoIncrement, Unique).',
        'En Casos de Uso y Secuencia: define actores, mensajes síncronos/asíncronos y activaciones temporales.',
      ],
      tips: '💡 Puedes tener múltiples diagramas de diferente tipo dentro del mismo proyecto y exportarlos a Enterprise Architect XMI.',
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

  // Pasos del Tour Guiado en Inglés
  readonly tourStepsEn: TourStep[] = [
    {
      title: '1. Create & Configure your Project',
      badge: 'Step 1 of 7',
      description: 'The starting point is defining your software project in the Dashboard.',
      details: [
        'Go to the main "Projects" screen and click "+ New Project".',
        'Enter the system name (e.g. "Sales System").',
        'Define the base Java package (e.g. "com.uagrm.studio").',
        'Select the Java version (Java 21 LTS recommended) and Spring Boot (3.4.0).',
        'Done! Your project will create a main diagram ready for modeling.',
      ],
      tips: '💡 The base package configured here determines the folder structure of your Spring Boot backend.',
    },
    {
      title: '2. Model UML & Architectural Diagrams',
      badge: 'Step 2 of 7',
      description: 'Build your system visually across 8 specialized diagram types.',
      details: [
        'In the top bar or sidebar, switch between diagram types: Class, Use Case, Sequence, Communication, Package, Component, Deployment, or Class Analysis.',
        'The left Toolbox dynamically updates its tools (Actors, Use Case Ovals, Lifelines, Boundary/Control/Entity nodes, Classes).',
        'Click any tool or double-click anywhere on the canvas to place nodes.',
        'In Class Diagrams: add attributes with visibility (+, -, #), data types (String, Long, UUID, Double, LocalDate) and modifiers (PK, AutoIncrement, Unique).',
        'In Use Cases & Sequence: model actors, synchronous/asynchronous messages and activation lifetimes.',
      ],
      tips: '💡 You can create multiple diagrams of distinct types within the same project and export them to Enterprise Architect XMI.',
    },
    {
      title: '3. Connect Relationships & Multiplicities',
      badge: 'Step 3 of 7',
      description: 'Define database associations and referential integrity.',
      details: [
        'In the left Toolbox, select the relationship type: Association, Aggregation, Composition, Generalization, or Realization.',
        'Click first on the source class, then click on the target class.',
        'Configure multiplicities at both ends (1..1, 1..*, 0..*).',
        'For example, for "Sale" and "Customer": a Sale has 1 Customer (1..1) and a Customer has many Sales (1..* or 0..*).',
        'The generator will automatically generate JPA annotations (@ManyToOne, @OneToMany) and foreign keys in Flyway.',
      ],
      tips: '💡 To toggle between selection mode and connection mode, press Escape or click the cursor icon in the Toolbox.',
    },
    {
      title: '4. Real-time Team Collaboration',
      badge: 'Step 4 of 7',
      description: 'Work concurrently with your team without overwriting changes.',
      details: [
        'On the project card in the Dashboard, click "Members".',
        'Invite teammates via email and assign roles: OWNER, EDITOR, or VIEWER.',
        'Upon entering the diagram, you will see real-time colored cursors for every active user.',
        'Exclusive Lock System (NodeLock): When a user edits a class, it is temporarily locked for others to prevent conflicts.',
        'Use the built-in room chat to coordinate development and modeling in real time.',
      ],
      tips: '💡 Users with VIEWER role can inspect the canvas and generate code, but cannot modify the model.',
    },
    {
      title: '5. AI Copilot & Multimodal Vision',
      badge: 'Step 5 of 7',
      description: 'Mutate diagrams on the fly using Artificial Intelligence.',
      details: [
        'Open the "AI Copilot" panel on the right side of the editor.',
        'Text Mode: Type instructions like "Create a Product entity with price, stock and category" or "Connect Product with SaleItem in 1-to-N relation".',
        'Vision / Camera Mode: Upload a hand-drawn sketch on paper or capture with your webcam.',
        'The AI analyzes the sketch and renders the classes and relationships directly on the canvas.',
      ],
      tips: '💡 You can instruct the AI to both create new classes and refactor existing entities.',
    },
    {
      title: '6. Fullstack Code Generator (Spring Boot & Flutter)',
      badge: 'Step 6 of 7',
      description: 'Transform your visual diagram into production-ready software in seconds.',
      details: [
        'In the editor\'s top bar, click "Generator".',
        'Toggle between "Spring Boot" and "Flutter" tabs to preview source code in real time.',
        'Generated Backend: Spring Boot 3 with Layered Architecture (JPA Entities, DTOs, Mappers, Repositories, Services, REST Controllers, JWT Auth, Flyway migrations, and Docker Compose).',
        'Generated Mobile: Flutter with Clean Architecture (BLoC, DataSources, Repositories, Entities, full CRUD screens, JWT Auth, and Local AI Assistant).',
        'Click "Download ZIP" to download the packaged project.',
      ],
      tips: '💡 The backend includes native PostgreSQL in Docker and BCrypt password encryption.',
    },
    {
      title: '7. Running on your Machine',
      badge: 'Step 7 of 7',
      description: 'Run the downloaded backend and mobile app in 3 simple steps.',
      details: [
        '1. Extract the ZIP file and open a terminal in the /backend folder.',
        '2. Start PostgreSQL database with Docker Compose.',
        '3. Run Spring Boot backend with Gradle.',
        '4. In another terminal inside /mobile_flutter, run the app on your mobile device or emulator.',
        'Default Admin credentials: admin@studio.com / admin123.',
      ],
      code: `# 1. Start PostgreSQL in Docker
docker compose -f docker-compose.local.yml up -d db

# 2. Run Spring Boot backend
gradle bootRun

# 3. In another terminal, run Flutter Mobile App
cd ../mobile_flutter
flutter run`,
      tips: '💡 To restart the database from scratch, use: docker compose -f docker-compose.local.yml down -v',
    },
  ];

  // Pasos del Tour activos según el idioma
  readonly currentTourSteps = computed<TourStep[]>(() => {
    return this.translationService.currentLang() === 'en' ? this.tourStepsEn : this.tourStepsEs;
  });

  // Píldoras de sugerencias rápidas en Español
  readonly quickPillsEs = [
    { label: '🚀 Guía Rápida (Paso a Paso)', query: 'iniciar tour' },
    { label: '📊 Tipos de Diagramas soportados', query: 'tipos de diagramas' },
    { label: '👤 Casos de Uso (Actores e Includes)', query: 'diagrama de casos de uso' },
    { label: '⏱️ Secuencia (Lifelines y Mensajes)', query: 'diagrama de secuencia' },
    { label: '💬 Comunicación y Flujos', query: 'diagrama de comunicacion' },
    { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
    { label: '📦 Paquetes y Componentes', query: 'diagramas de paquetes y componentes' },
    { label: '🎨 ¿Cómo crear clases y relaciones?', query: 'como modelar clases y relaciones' },
    { label: '🐳 ¿Cómo correr con Docker y Gradle?', query: 'comandos de ejecucion' },
    { label: '⚡ ¿Cómo generar Spring Boot y Flutter?', query: 'como generar codigo' },
    { label: '📱 ¿Cómo funciona la IA Local en el móvil?', query: 'ia en flutter y qwen' },
    { label: '👥 ¿Cómo colaborar en equipo?', query: 'colaboracion en tiempo real' },
    { label: '🔄 ¿Cómo importar/exportar a Enterprise Architect?', query: 'enterprise architect xmi' },
  ];

  // Píldoras de sugerencias rápidas en Inglés
  readonly quickPillsEn = [
    { label: '🚀 Quick Guide (Step by Step)', query: 'start tour' },
    { label: '📊 Supported Diagram Types', query: 'diagram types' },
    { label: '👤 Use Cases (Actors & Includes)', query: 'use case diagram' },
    { label: '⏱️ Sequence (Lifelines & Messages)', query: 'sequence diagram' },
    { label: '💬 Communication Diagrams', query: 'communication diagram' },
    { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
    { label: '📦 Packages & Components', query: 'packages and components' },
    { label: '🎨 How to create classes & relations?', query: 'how to model classes' },
    { label: '🐳 How to run with Docker & Gradle?', query: 'run commands' },
    { label: '⚡ How to generate Spring Boot & Flutter?', query: 'how to generate code' },
    { label: '📱 How does Local AI work on mobile?', query: 'mobile ai and qwen' },
    { label: '👥 How to collaborate in teams?', query: 'realtime collaboration' },
    { label: '🔄 How to import/export Enterprise Architect?', query: 'enterprise architect xmi' },
  ];

  // Píldoras activas según el idioma
  readonly quickPills = computed(() => {
    return this.translationService.currentLang() === 'en' ? this.quickPillsEn : this.quickPillsEs;
  });

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

  toggleOpen(): void {
    this.guideService.toggleGuide();
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  resetChat(): void {
    this.isTourActive.set(false);
    this.currentTourStepIndex.set(0);
    this.conversationMessages.set([]);
  }

  copyCode(code: string, id: string): void {
    navigator.clipboard.writeText(code);
    this.copiedCodeId.set(id);
    setTimeout(() => {
      this.copiedCodeId.set(null);
    }, 2000);
  }

  formatMarkdown(rawText: string, sender: 'bot' | 'user' = 'bot'): SafeHtml {
    if (!rawText) return '';
    if (sender === 'user') {
      const escaped = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      return this.sanitizer.bypassSecurityTrustHtml(escaped);
    }

    let html = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Headers ### H3
    html = html.replace(
      /^###\s+(.+)$/gm,
      '<h4 class="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2.5 mb-1.5 flex items-center gap-1.5 pb-0.5 border-b border-slate-200/60 dark:border-slate-700/50">$1</h4>'
    );

    // 2. Headers ## H2
    html = html.replace(
      /^##\s+(.+)$/gm,
      '<h3 class="font-bold text-base text-slate-900 dark:text-slate-100 mt-3 mb-2">$1</h3>'
    );

    // 3. Negrita **texto**
    html = html.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>'
    );

    // 4. Código en línea `codigo`
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-[#1E2548] text-indigo-700 dark:text-indigo-300 font-mono text-[11px] border border-slate-300/80 dark:border-[#2D3762]">$1</code>'
    );

    // 5. Cajas de Tips / Alertas con icono
    html = html.replace(
      /^💡\s+(.+)$/gm,
      '<div class="p-2.5 my-2.5 bg-amber-50 dark:bg-amber-950/30 border-l-3 border-amber-500 rounded-r text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed flex items-start gap-2 shadow-2xs"><span class="shrink-0 text-sm">💡</span><div class="flex-1">$1</div></div>'
    );
    html = html.replace(
      /^🎉\s+(.+)$/gm,
      '<div class="p-2.5 my-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-l-3 border-emerald-500 rounded-r text-emerald-900 dark:text-emerald-200 text-[11px] leading-relaxed flex items-start gap-2 shadow-2xs"><span class="shrink-0 text-sm">🎉</span><div class="flex-1">$1</div></div>'
    );

    // 6. Viñetas con sub-niveles: "  - texto"
    html = html.replace(
      /^\s{2,}[-•*]\s+(.+)$/gm,
      '<div class="flex items-start gap-2 my-1 text-slate-600 dark:text-slate-300 pl-4 text-[11px]"><span class="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5 shrink-0"></span><span class="flex-1">$1</span></div>'
    );

    // 7. Viñetas principales: "• texto" o "- texto"
    html = html.replace(
      /^[•\-*]\s+(.+)$/gm,
      '<div class="flex items-start gap-2 my-1 text-slate-700 dark:text-slate-200 pl-0.5 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1.5 shrink-0"></span><span class="flex-1">$1</span></div>'
    );

    // 8. Párrafos y saltos de línea dobles
    html = html.replace(/\n\n/g, '<div class="h-2"></div>');

    // 9. Saltos de línea simples (que no sean después o antes de tags de bloque)
    html = html.replace(/(?<!(<\/h[234]>|<\/div>))\n(?!(<h[234]>|<div))/g, '<br/>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ==================== LÓGICA DEL TOUR GUIADO ====================

  startTour(): void {
    this.isTourActive.set(true);
    this.currentTourStepIndex.set(0);
    this.sendTourStepMessage(0);
  }

  nextTourStep(): void {
    const nextIdx = this.currentTourStepIndex() + 1;
    if (nextIdx < this.currentTourSteps().length) {
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
    if (index >= 0 && index < this.currentTourSteps().length) {
      this.currentTourStepIndex.set(index);
      this.sendTourStepMessage(index);
    }
  }

  finishTour(): void {
    this.isTourActive.set(false);
    const isEn = this.translationService.currentLang() === 'en';
    this.addBotMessage(
      isEn
        ? '🎉 **Congratulations! You have completed the UML Architect Interactive Tour.**\n\nYou now know the entire workflow: from creating your project to modeling on the canvas, generating Fullstack code, and running the backend and mobile app.\n\nDo you have any specific questions? Type them in the chat and I will be happy to help!'
        : '🎉 **¡Felicidades! Has completado el Tour Interactivo de UML Architect.**\n\nYa conoces todo el flujo: desde crear tu proyecto hasta modelar en el lienzo, generar código Fullstack y poner en marcha el backend y la app móvil.\n\n¿Tienes alguna duda específica? Escríbela en el chat y con gusto te respondo.',
      undefined,
      undefined,
      isEn
        ? [
            { label: '🐳 View Docker & Gradle commands', query: 'run commands' },
            { label: '📱 View Qwen2.5 Local AI integration', query: 'mobile ai and qwen' },
            { label: '🔄 Restart Tour', query: 'start tour' },
          ]
        : [
            { label: '🐳 Ver comandos Docker & Gradle', query: 'comandos de ejecucion' },
            { label: '📱 Ver integración con IA local Qwen2.5', query: 'ia en flutter y qwen' },
            { label: '🔄 Reiniciar Tour', query: 'iniciar tour' },
          ],
    );
  }

  private sendTourStepMessage(index: number): void {
    const step = this.currentTourSteps()[index];
    const detailsFormatted = step.details.map((d) => `• ${d}`).join('\n');
    const text = `### 📘 ${step.title} (${step.badge})\n\n${step.description}\n\n${detailsFormatted}\n\n${step.tips}`;

    this.addBotMessage(text, step.code, 'bash');
  }

  // ==================== PROCESAMIENTO CONVERSACIONAL ====================

  sendMessage(textToSend?: string): void {
    const query = (textToSend ?? this.userInput()).trim();
    if (!query) return;

    // Agregar mensaje del usuario a conversationMessages
    this.conversationMessages.update((msgs) => [
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
    this.conversationMessages.update((msgs) => [
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
    const isEn = this.translationService.currentLang() === 'en';

    // 1. Iniciar o navegar en el tour
    if (
      text.includes('iniciar tour') ||
      text.includes('comenzar tour') ||
      text.includes('start tour') ||
      text.includes('tour') ||
      text.includes('empezar') ||
      text.includes('begin') ||
      text.includes('tutorial') ||
      text.includes('paso a paso') ||
      text.includes('step by step')
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
      text.includes('command') ||
      text.includes('ejecut') ||
      text.includes('correr') ||
      text.includes('run') ||
      text.includes('compil') ||
      text.includes('build') ||
      text.includes('levantar') ||
      text.includes('arrancar') ||
      text.includes('start')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🚀 Commands to Run the Downloaded Project\n\nTo start the generated project on your local machine, run these steps in your terminal:\n\n**1. Start PostgreSQL Database:**\nInside `/backend`, run Docker Compose in the background.\n\n**2. Build & Run Spring Boot Backend:**\nExecute Gradle. Flyway will automatically apply database migrations and seed the default admin account (`admin@studio.com` / `admin123`).\n\n**3. Run Flutter Mobile App:**\nIn another terminal, navigate to `/mobile_flutter` and run the app on your mobile device or emulator.'
          : '### 🚀 Comandos para Ejecutar el Proyecto Descargado\n\nPara poner en marcha el proyecto generado en tu máquina local, sigue estos sencillos pasos desde tu terminal:\n\n**1. Iniciar la Base de Datos PostgreSQL:**\nDentro de la carpeta `/backend`, ejecuta Docker Compose en segundo plano.\n\n**2. Compilar y Ejecutar el Backend (Spring Boot 3):**\nEjecuta Gradle. Flyway aplicará automáticamente las migraciones y creará el usuario administrador por defecto (`admin@studio.com` / `admin123`).\n\n**3. Ejecutar la App Móvil (Flutter):**\nEn otra terminal, entra a `/mobile_flutter` y corre la aplicación en tu dispositivo o emulador.',
        `# === STEP 1: Start PostgreSQL in Docker (port 5431/5432) ===
cd backend
docker compose -f docker-compose.local.yml up -d db

# === STEP 2: Start Spring Boot 3 Server ===
gradle bootRun

# === STEP 3 (Optional): Run Flutter Mobile App ===
cd ../mobile_flutter
flutter run`,
        'bash',
        isEn
          ? [
              { label: '🔑 Default credentials?', query: 'default credentials' },
              { label: '📱 How to use Qwen2.5 AI?', query: 'mobile ai and qwen' },
              { label: '⚡ How to generate code?', query: 'how to generate code' },
            ]
          : [
              { label: '🔑 ¿Cuáles son las credenciales por defecto?', query: 'credenciales por defecto' },
              { label: '📱 ¿Cómo usar la IA local Qwen2.5?', query: 'ia en flutter y qwen' },
              { label: '⚡ ¿Cómo generar el código?', query: 'como generar codigo' },
            ],
      );
      return;
    }

    // 3. Credenciales y Autenticación
    if (
      text.includes('credencial') ||
      text.includes('credential') ||
      text.includes('admin') ||
      text.includes('usuario') ||
      text.includes('user') ||
      text.includes('password') ||
      text.includes('contraseña') ||
      text.includes('clave') ||
      text.includes('login') ||
      text.includes('auth')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🔑 Default Access Credentials\n\nThe system automatically seeds an Administrator user in the database (with BCrypt encrypted password):\n\n• **Email:** `admin@studio.com`\n• **Password:** `admin123`\n• **Role:** `ADMIN`\n\n**How does authentication work?**\n• The backend exposes `/api/auth/login` and `/api/auth/register` endpoints protected with **JWT Tokens (Bearer)**.\n• The Flutter mobile app securely stores tokens and profile details locally (`TokenStorageService`) and displays the connected user on the **My Profile** screen.'
          : '### 🔑 Credenciales de Acceso por Defecto\n\nEl sistema inicializa automáticamente un usuario con rol de Administrador en la base de datos (con contraseña encriptada en BCrypt):\n\n• **Correo electrónico:** `admin@studio.com`\n• **Contraseña:** `admin123`\n• **Rol:** `ADMIN`\n\n**¿Cómo funciona la autenticación?**\n• El backend expone endpoints `/api/auth/login` y `/api/auth/register` protegidos con **JWT Token (Bearer)**.\n• La app móvil Flutter almacena de forma segura el token y los datos del perfil en local (`TokenStorageService`) y muestra el usuario conectado en la pantalla de **Mi Perfil**.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🐳 View backend run commands', query: 'run commands' },
              { label: '📱 View mobile app features', query: 'mobile ai and qwen' },
            ]
          : [
              { label: '🐳 Ver comandos para correr el backend', query: 'comandos de ejecucion' },
              { label: '📱 Ver funciones de la app móvil', query: 'ia en flutter y qwen' },
            ],
      );
      return;
    }

    // 4. Generación de Código
    if (
      text.includes('generar') ||
      text.includes('generate') ||
      text.includes('generator') ||
      text.includes('codigo') ||
      text.includes('código') ||
      text.includes('code') ||
      text.includes('spring') ||
      text.includes('descargar') ||
      text.includes('download') ||
      text.includes('zip') ||
      text.includes('export')
    ) {
      this.addBotMessage(
        isEn
          ? '### ⚡ Automated Fullstack Code Generator\n\nUML Architect compiles your visual diagram into clean, production-ready code:\n\n**1. Backend (Spring Boot 3 + PostgreSQL):**\n• Typed **REST Controllers** with OpenAPI/Swagger and Request/Response DTOs.\n• Decoupled **Services & Business Logic** with Mappers.\n• **Spring Data JPA Repositories** and Entities with relational mappings.\n• **Flyway Migrations (SQL)** supporting native UUID (`pgcrypto`) and numeric autoincrement sequences (`BIGSERIAL`).\n• **JWT Security** with BCrypt and authorization filters.\n• Pre-configured **Docker Compose** files.\n\n**2. Mobile Frontend (Flutter):**\n• **Clean Architecture** layered structure (Data, Domain, Presentation).\n• Reactive **BLoC State Management**.\n• Complete **CRUD Screens** with validation and interactive cards.\n• **Local AI Assistant** with on-device **Qwen 2.5 GGUF** download via llama.cpp and native semantic engine.\n\n**How to download?**\nIn the editor top bar, click the **"Generator"** button and press **"Download ZIP"**.'
          : '### ⚡ Generador de Código Fullstack Automatizado\n\nUML Architect compila tu diagrama visual en código limpio listo para producción:\n\n**1. Backend (Spring Boot 3 + PostgreSQL):**\n• **Controladores REST** tipados con Swagger/OpenAPI y DTOs de petición y respuesta.\n• **Servicios y Lógica de Negocio** desacoplada con Mappers.\n• **Repositorios Spring Data JPA** y Entidades con relaciones tipadas.\n• **Migraciones Flyway (SQL)** con soporte de UUID nativo (`pgcrypto`) y secuencias numéricas (`BIGSERIAL`).\n• **Seguridad JWT** con BCrypt y filtros de autorización.\n• **Docker Compose** preconfigurado.\n\n**2. Frontend Móvil (Flutter):**\n• **Clean Architecture** estructurada en Capas (Data, Domain, Presentation).\n• **Gestión de Estado BLoC** reactiva.\n• **Pantallas CRUD completas** con validaciones y tarjetas interactivas.\n• **Asistente IA Local** con descarga on-device de **Qwen 2.5 GGUF** vía llama.cpp y motor semántico nativo.\n\n**¿Cómo descargarlo?**\nEn la barra superior del editor, haz clic en el botón **"Generador"** y presiona **"Descargar ZIP"**.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🐳 How to execute the downloaded ZIP?', query: 'run commands' },
              { label: '🎨 How to create classes on canvas?', query: 'how to model classes' },
            ]
          : [
              { label: '🐳 ¿Cómo ejecuto el ZIP descargado?', query: 'comandos de ejecucion' },
              { label: '🎨 ¿Cómo creo clases en el lienzo?', query: 'como modelar clases y relaciones' },
            ],
      );
      return;
    }

    // 5. Inteligencia Artificial en el Móvil y Qwen 2.5
    if (
      text.includes('pocketpal') ||
      text.includes('flutter') ||
      text.includes('movil') ||
      text.includes('móvil') ||
      text.includes('mobile') ||
      text.includes('ia local') ||
      text.includes('local ai') ||
      text.includes('gemma') ||
      text.includes('qwen') ||
      text.includes('voz') ||
      text.includes('voice') ||
      text.includes('microfono') ||
      text.includes('microphone') ||
      text.includes('audio') ||
      text.includes('speech')
    ) {
      this.addBotMessage(
        isEn
          ? '### 📱 Autonomous On-Device Local AI in the Mobile App\n\nThe Flutter mobile application includes an intelligent assistant that runs **100% locally on your smartphone without requiring external apps like PocketPal**:\n\n**1. On-Device Qwen 2.5 GGUF Inference:**\n• Inside the Flutter app, tap the AI chat screen.\n• Tap **"Download / Load Qwen"** to fetch the lightweight, quantized **Qwen 2.5 model (`qwen2.5-0.5b-instruct-q4_k_m.gguf`)** directly from Hugging Face onto device storage.\n• In-memory inference is executed locally using **llama.cpp / fllama**, providing fast conversational responses with zero data leaving your phone.\n\n**2. Autonomous On-Device Semantic Engine:**\n• If the model is not yet loaded or you want zero RAM overhead, the app automatically switches to its native regex and semantic processor.\n• It executes full CRUD operations directly against the backend REST API:\n  - *"register a user named Ana, email ana@gmail.com, password 123"*\n  - *"update customer 2 changing phone to 77889900"*\n  - *"delete purchase with id 5"*\n  - *"list all sales"*\n\n**3. Voice Dictation (Speech-to-Text):**\n• Tap the microphone button to dictate commands in natural language.'
          : '### 📱 Inteligencia Artificial Local On-Device en la App Móvil\n\nLa app móvil Flutter incluye un asistente inteligente que se ejecuta **100% en local en tu teléfono, sin necesidad de apps externas como PocketPal**:\n\n**1. Inferencia On-Device con Qwen 2.5 GGUF:**\n• Dentro de la app Flutter, ingresa a la pantalla del Asistente IA.\n• Pulsa **"Cargar Qwen"** o **"Descargar"**: la app descargará automáticamente el modelo cuantizado **Qwen 2.5 (`qwen2.5-0.5b-instruct-q4_k_m.gguf`)** directamente desde Hugging Face al almacenamiento del teléfono.\n• La inferencia se ejecuta en el dispositivo mediante **llama.cpp / fllama**, respondiendo en lenguaje natural de forma privada sin conexión a servidores externos.\n\n**2. Motor Semántico On-Device Autónomo:**\n• Si el modelo no está cargado o prefieres ahorrar batería/RAM, la app activa automáticamente el motor semántico nativo.\n• Entiende órdenes en lenguaje natural para ejecutar todo el ciclo CRUD en la API REST:\n  - *"regístrame un usuario con nombre Ana, email ana@gmail.com, password 123"*\n  - *"actualiza el cliente 2 cambiando el teléfono a 77889900"*\n  - *"elimina la compra con id 5"*\n  - *"lista las ventas"*\n\n**3. Dictado por Voz:**\n• Pulsa el botón del micrófono y habla en español para enviar tus comandos sin teclear.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🐳 View backend run commands', query: 'run commands' },
              { label: '🔑 View admin credentials', query: 'default credentials' },
            ]
          : [
              { label: '🐳 Ver comandos para correr el backend', query: 'comandos de ejecucion' },
              { label: '🔑 Ver credenciales de administrador', query: 'credenciales por defecto' },
            ],
      );
      return;
    }

    // 6. Modelado UML: Clases, Atributos y Métodos
    if (
      text.includes('clase') ||
      text.includes('class') ||
      text.includes('atributo') ||
      text.includes('attribute') ||
      text.includes('metodo') ||
      text.includes('método') ||
      text.includes('method') ||
      text.includes('pk') ||
      text.includes('clave primaria') ||
      text.includes('primary key') ||
      text.includes('tipo') ||
      text.includes('type') ||
      text.includes('dato') ||
      text.includes('data')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🎨 Modeling UML Classes & Attributes\n\n**How to add a class?**\n• Click the `+ Class` button on the left Toolbox or double-click anywhere on the empty canvas.\n\n**Supported data types:**\n• `String`: Text, names, emails, descriptions (`VARCHAR(255)` / `TEXT`).\n• `Long` / `Integer`: Whole numbers, counts, numeric identifiers (`BIGINT` / `INTEGER`).\n• `UUID`: Universally unique identifiers (`UUID` with native generation in PostgreSQL).\n• `Double` / `BigDecimal`: Amounts, prices, decimals.\n• `Boolean`: Logical flags (`true` / `false`).\n• `LocalDate` / `LocalDateTime`: Dates and timestamps (`DATE` / `TIMESTAMP`).\n\n**Modifiers:**\n• **PK:** Marks the Primary Key.\n• **AutoIncrement:** Enables automatic database sequences (`BIGSERIAL`).\n• **Unique:** Ensures non-duplicate values (e.g. emails, invoice numbers).\n• **Nullable:** Allows null values.'
          : '### 🎨 Modelado de Clases y Atributos UML\n\n**¿Cómo agregar una clase?**\n• Haz clic en el botón `+ Clase` del Toolbox lateral izquierdo o haz doble clic en cualquier área vacía del lienzo.\n\n**Tipos de datos soportados por el generador:**\n• `String`: Textos, nombres, correos, descripciones (`VARCHAR(255)` / `TEXT`).\n• `Long` / `Integer`: Números enteros, cantidades, identificadores numéricos (`BIGINT` / `INTEGER`).\n• `UUID`: Identificadores únicos universales (`UUID` con generación nativa en PostgreSQL).\n• `Double` / `BigDecimal`: Montos, precios, subtotales, totales con decimales.\n• `Boolean`: Banderas lógicas (`true` / `false`).\n• `LocalDate` / `LocalDateTime`: Fechas y marcas de tiempo (`DATE` / `TIMESTAMP`).\n\n**Modificadores:**\n• **PK:** Define la clave primaria.\n• **AutoIncrement:** Habilita secuencias automáticas en base de datos (`BIGSERIAL`).\n• **Unique:** Asegura que no existan valores duplicados (ej: emails, números de factura, NIT).\n• **Nullable:** Permite que el campo acepte nulos.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🔗 How to connect relationships?', query: 'how to connect relations' },
              { label: '⚡ Generate Spring Boot code', query: 'how to generate code' },
            ]
          : [
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
      text.includes('relation') ||
      text.includes('relationship') ||
      text.includes('conectar') ||
      text.includes('connect') ||
      text.includes('multiplicidad') ||
      text.includes('multiplicity') ||
      text.includes('asociacion') ||
      text.includes('asociación') ||
      text.includes('association') ||
      text.includes('composicion') ||
      text.includes('composición') ||
      text.includes('composition') ||
      text.includes('agregacion') ||
      text.includes('agregación') ||
      text.includes('aggregation') ||
      text.includes('herencia') ||
      text.includes('inheritance') ||
      text.includes('generalization') ||
      text.includes('foreign key') ||
      text.includes('fk')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🔗 Connecting Relationships & Multiplicities\n\n**Steps to connect two classes:**\n1. In the left Toolbox, click on the relationship type (Association, Aggregation, Composition, Generalization, or Realization).\n2. The cursor activates connection mode.\n3. Click on the **Source Class** (e.g. `Sale`).\n4. Click on the **Target Class** (e.g. `Customer`).\n5. The interactive link is rendered on the canvas.\n\n**Semantic Relationship Types:**\n• **Simple Association:** Standard connection between entities.\n• **Aggregation (Hollow diamond):** "Whole-part" relationship where parts can exist independently.\n• **Composition (Solid diamond):** Strong lifecycle ownership (e.g. `Sale` and `SaleItem`).\n• **Generalization / Inheritance (Hollow triangle arrow):** Defines subclasses and superclasses.\n\n**Multiplicities:**\n• Assign `1..1`, `0..1`, `1..*` or `*` to each end. The generator maps this to `@ManyToOne`, `@OneToMany` or `@OneToOne` in Spring Boot and creates foreign keys in Flyway.'
          : '### 🔗 Conexión de Relaciones y Multiplicidades\n\n**Pasos para conectar dos clases:**\n1. En el Toolbox lateral izquierdo, haz clic sobre el tipo de relación que deseas crear (Asociación, Agregación, Composición, Herencia o Realización).\n2. El cursor se activará en modo de conexión.\n3. Haz clic en la **Clase Origen** (ej: `Venta`).\n4. Haz clic en la **Clase Destino** (ej: `Cliente`).\n5. Se creará el enlace visual en el lienzo.\n\n**Tipos de Relaciones Semánticas:**\n• **Asociación Simple:** Conexión estándar entre dos entidades.\n• **Agregación (Rombo hueco):** Relación "todo-parte" donde las partes pueden existir independientemente.\n• **Composición (Rombo relleno):** Relación fuerte de pertenencia de ciclo de vida (ej: `Venta` y `DetalleVenta`).\n• **Herencia / Generalización (Flecha triangular hueca):** Define subclases y superclases.\n\n**Multiplicidades:**\n• Puedes asignar `1..1`, `0..1`, `1..*` o `*` en cada extremo. El generador traducirá esto a `@ManyToOne`, `@OneToMany` o `@OneToOne` en Spring Boot y las claves foráneas correspondientes en PostgreSQL.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🎨 How to model classes & attributes?', query: 'how to model classes' },
              { label: '⚡ How to generate code?', query: 'how to generate code' },
            ]
          : [
              { label: '🎨 ¿Cómo crear atributos y clases?', query: 'como modelar clases y atributos' },
              { label: '⚡ ¿Cómo generar código?', query: 'como generar codigo' },
            ],
      );
      return;
    }

    // 8. Colaboración en Vivo
    if (
      text.includes('colabora') ||
      text.includes('collaborat') ||
      text.includes('equipo') ||
      text.includes('team') ||
      text.includes('miembro') ||
      text.includes('member') ||
      text.includes('invitar') ||
      text.includes('invite') ||
      text.includes('tiempo real') ||
      text.includes('real time') ||
      text.includes('realtime') ||
      text.includes('bloqueo') ||
      text.includes('lock') ||
      text.includes('nodelock') ||
      text.includes('socket')
    ) {
      this.addBotMessage(
        isEn
          ? '### 👥 Real-Time Multi-User Collaboration\n\nUML Architect enables multiple developers to work on the same diagram simultaneously using **WebSockets (Socket.io)**:\n\n**1. Invite Members:**\n• In the Projects Dashboard, click the **"Members"** button on the project card.\n• Enter your teammate\'s email and assign a role:\n  - **OWNER:** Full administrative control.\n  - **EDITOR:** Can create, edit, and delete classes and relations in real time.\n  - **VIEWER:** Read-only access (can inspect diagram and generate code).\n\n**2. Remote Cursors:**\n• See your teammates\' live colored cursors moving across the canvas with their name.\n\n**3. NodeLock Concurrency Protection:**\n• When a user opens a class to edit, the system locks that entity for others, preventing conflicting overwrites.'
          : '### 👥 Colaboración Multiusuario en Tiempo Real\n\nUML Architect permite que múltiples desarrolladores trabajen en el mismo diagrama simultáneamente mediante **WebSockets (Socket.io)**:\n\n**1. Invitar Miembros:**\n• En el Dashboard de Proyectos, haz clic en el botón **"Miembros"** de la tarjeta del proyecto.\n• Ingresa el correo de tu colega y asígnale un rol:\n  - **OWNER:** Propietario del proyecto con control total.\n  - **EDITOR:** Puede crear, modificar y eliminar clases y relaciones en tiempo real.\n  - **VIEWER:** Solo lectura (puede explorar el lienzo y generar código).\n\n**2. Cursores Remotos:**\n• Verás los cursores de tus compañeros moviéndose por el lienzo en tiempo real con su nombre y color.\n\n**3. Bloqueo de Nodos (NodeLock):**\n• Cuando alguien abre para editar una clase, el sistema bloquea temporalmente esa entidad para los demás evitando sobreescrituras accidentales.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🚀 Start Guided Tour', query: 'start tour' },
              { label: '⚡ Generate project code', query: 'how to generate code' },
            ]
          : [
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
      text.includes('importar') ||
      text.includes('import') ||
      text.includes('exportar') ||
      text.includes('export')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🔄 Enterprise Architect Interoperability (XMI 2.1)\n\nThe system offers complete bidirectional compatibility with **Enterprise Architect**:\n\n**1. Export to Enterprise Architect:**\n• In the top bar, click **"Export"** and select **"Enterprise Architect (.xmi)"**.\n• Generates a standard XMI 2.1 file containing diagrams, classes, attributes, visibilities, and relationships compatible with Sparx Systems Enterprise Architect.\n\n**2. Import from Enterprise Architect:**\n• In the top bar, click **"Import XMI"** and upload your `.xmi` file.\n• The parser converts XMI entities into interactive canvas nodes and connectors.\n\n**3. Version History:**\n• Save diagram snapshots and restore previous versions at any time.'
          : '### 🔄 Interoperabilidad con Enterprise Architect (XMI 2.1)\n\nEl sistema cuenta con compatibilidad bidireccional completa con **Enterprise Architect**:\n\n**1. Exportar a Enterprise Architect:**\n• En la barra superior, haz clic en **"Exportar"** y selecciona **"Enterprise Architect (.xmi)"**.\n• Genera un archivo estándar XMI 2.1 con diagramas, clases, atributos, visibilidades y relaciones reconocibles por Sparx Systems Enterprise Architect.\n\n**2. Importar desde Enterprise Architect:**\n• En la barra superior, selecciona **"Importar XMI"** y sube tu archivo `.xmi`.\n• El conversor transformará automáticamente los elementos XMI en nodos y conexiones interactivas en el lienzo web.\n\n**3. Historial de Versiones:**\n• Puedes guardar snapshots del diagrama y restaurar versiones anteriores en cualquier momento.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '⚡ Generate Spring Boot code', query: 'how to generate code' },
              { label: '🚀 View Guided Tour', query: 'start tour' },
            ]
          : [
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
      text.includes('assistant') ||
      text.includes('gemini') ||
      text.includes('camara') ||
      text.includes('cámara') ||
      text.includes('camera') ||
      text.includes('foto') ||
      text.includes('photo') ||
      text.includes('boceto') ||
      text.includes('sketch')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🤖 AI Copilot on the Canvas\n\nIn the editor, click the **"AI Copilot"** button:\n\n• **Natural Language Prompts:**\n  Instruct the AI in plain English or Spanish. For example:\n  *"Create a billing module with Customer, Invoice and InvoiceItem with their relationships"*\n\n• **Multimodal Visual Input (Camera / Sketch):**\n  Have a diagram drawn on a whiteboard or paper? Upload a picture or turn on your webcam. The AI parses the shapes and text and renders the classes and relations directly on your canvas.'
          : '### 🤖 Copilot de Inteligencia Artificial en el Lienzo\n\nEn la esquina superior derecha del editor, haz clic en el botón flotante **"Copilot IA"**:\n\n• **Comandos en Lenguaje Natural:**\n  Escribe en español lo que deseas en el diagrama. Ejemplo:\n  *"Crea un módulo de compras con Proveedor, Compra y DetalleCompra con sus relaciones"*\n\n• **Entrada Visual Multimodal (Cámara o Foto):**\n  ¿Tienes un diagrama dibujado en una pizarra o en una hoja de papel? Sube la foto o activa tu cámara web. La IA interpretará los rectángulos, textos y flechas y colocará las clases y relaciones directamente en el lienzo.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '🎨 How to edit classes manually?', query: 'how to model classes' },
              { label: '⚡ Generate project code', query: 'how to generate code' },
            ]
          : [
              { label: '🎨 ¿Cómo editar clases manualmente?', query: 'como modelar clases y atributos' },
              { label: '⚡ Generar código del diagrama', query: 'como generar codigo' },
            ],
      );
      return;
    }

    // 11. Visión General de Tipos de Diagramas Soportados
    if (
      text.includes('tipo de diagrama') ||
      text.includes('tipos de diagrama') ||
      text.includes('diagram type') ||
      text.includes('diagram types') ||
      text.includes('que diagramas') ||
      text.includes('qué diagramas') ||
      text.includes('cuales diagramas') ||
      text.includes('cuáles diagramas') ||
      text.includes('supported diagrams') ||
      text.includes('todos los diagramas')
    ) {
      this.addBotMessage(
        isEn
          ? '### 📊 Supported UML & Architectural Diagram Types\n\nUML/ER Studio supports 8 integrated diagram types with interactive canvas modeling and Enterprise Architect (XMI) compatibility:\n\n1. **Class Diagram (`class`):** Static structure, typed attributes, visibility, relationships (association, composition, aggregation, generalization) and automatic Spring Boot code generation.\n2. **Use Case Diagram (`use_case`):** Functional requirements, actors (stick figure), use cases (ovals), `<<include>>`, `<<extend>>` and System Boundaries.\n3. **Sequence Diagram (`sequence`):** Temporal interactions, lifelines, activation blocks, synchronous, asynchronous and reply messages.\n4. **Communication Diagram (`communication`):** Object collaboration topology with hierarchically numbered sequential messages (`1:`, `1.1:`, `2:`).\n5. **Class Analysis Diagram (`class_analysis`):** Jacobson Robustness Analysis (Boundary, Control, Entity) linking use cases to technical design.\n6. **Package Diagram (`package`):** System modularity, architectural subsystems and dependencies.\n7. **Component Diagram (`component`):** Software modules, ports, provided and required assembly interfaces.\n8. **Deployment Diagram (`deployment`):** Physical execution nodes, database servers, cloud environments and deployment artifacts.'
          : '### 📊 Tipos de Diagramas Soportados en UML/ER Studio\n\nNuestra suite soporta 8 tipos de diagramas estandarizados con modelado interactivo y compatibilidad bidireccional con Enterprise Architect (XMI):\n\n1. **Diagrama de Clases (`class`):** Estructura estática del dominio, atributos tipados, PKs, visibilidades, métodos, relaciones semánticas y generación automática de Spring Boot 3 y migraciones Flyway.\n2. **Diagrama de Casos de Uso (`use_case`):** Requerimientos del sistema, actores, casos de uso (óvalos), relaciones `<<include>>`, `<<extend>>` y límites del sistema (*System Boundary*).\n3. **Diagrama de Secuencia (`sequence`):** Interacción dinámica temporal, líneas de vida (*Lifelines*), bloques de activación y mensajes síncronos, asíncronos y de retorno.\n4. **Diagrama de Comunicación (`communication`):** Topología estructural de objetos colaboradores con mensajes numerados secuenciales (`1:`, `1.1:`, `2:`) y flechas directrices.\n5. **Diagrama de Análisis de Clases (`class_analysis`):** Análisis de Robustez de Ivar Jacobson (Boundary, Control, Entity) para transicionar de casos de uso a diseño técnico.\n6. **Diagrama de Paquetes (`package`):** Modularización en paquetes, subsistemas y dependencias de arquitectura.\n7. **Diagrama de Componentes (`component`):** Componentes ejecutables, puertos e interfaces provistas y requeridas (conectores assembly).\n8. **Diagrama de Despliegue (`deployment`):** Nodos físicos, servidores de base de datos, entornos de ejecución y artefactos.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '👤 Use Case Diagrams', query: 'use case diagram' },
              { label: '⏱️ Sequence Diagrams', query: 'sequence diagram' },
              { label: '💬 Communication Diagrams', query: 'communication diagram' },
              { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
            ]
          : [
              { label: '👤 Casos de Uso', query: 'diagrama de casos de uso' },
              { label: '⏱️ Secuencia', query: 'diagrama de secuencia' },
              { label: '💬 Comunicación', query: 'diagrama de comunicacion' },
              { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
            ],
      );
      return;
    }

    // 12. Diagrama de Casos de Uso (Use Cases)
    if (
      text.includes('caso de uso') ||
      text.includes('casos de uso') ||
      text.includes('use case') ||
      text.includes('usecase') ||
      text.includes('actor') ||
      text.includes('include') ||
      text.includes('extend') ||
      text.includes('limite del sistema') ||
      text.includes('límite del sistema') ||
      text.includes('system boundary')
    ) {
      this.addBotMessage(
        isEn
          ? '### 👤 Use Case Diagrams (`use_case`)\n\nCapture system functional requirements from the perspective of external actors.\n\n**Visual Elements in Toolbox:**\n• **Actor (Stick Figure):** External users, external systems, or time triggers that initiate or participate in actions.\n• **Use Case (Oval):** Discrete service or goal that the system provides to produce value.\n• **System Boundary (Frame):** Rectangular container grouping use cases inside the system perimeter, keeping external actors outside.\n\n**Relationships & Connectors:**\n• **Association:** Plain line connecting an Actor to a Use Case.\n• **Include (`<<include>>`):** Mandatory dependency where the base use case always invokes the included behavior (e.g. *Checkout* `--<<include>>-->` *Process Payment*).\n• **Extend (`<<extend>>`):** Optional or conditional extension point (e.g. *Generate Invoice* `<--<<extend>>--* *Request Home Delivery*).\n• **Generalization:** Inheritance hierarchy between Actors (e.g. *Supervisor* inherits from *Employee*) or specialized Use Cases.\n\n**Tip:** Double-click any element on the canvas to edit its name, alias, and descriptive notes.'
          : '### 👤 Diagrama de Casos de Uso (`use_case`)\n\nModela los requerimientos funcionales y las fronteras de tu sistema desde la perspectiva de los usuarios externos.\n\n**Elementos en el Toolbox:**\n• **Actor (Figura Humana):** Usuario humano, rol externo, sistema secundario o reloj de tiempo que interactúa con el software.\n• **Caso de Uso (Óvalo):** Unidad funcional atómica que produce un resultado observable de valor.\n• **Límites del Sistema (*System Boundary*):** Marco rectangular delimitador que agrupa los casos de uso dentro del alcance del software y deja a los actores en el exterior.\n\n**Conectores y Relaciones:**\n• **Asociación Simple:** Línea continua que vincula al Actor con el Caso de Uso en el que participa.\n• **Inclusión (`<<include>>`):** Relación obligatoria donde el caso base siempre ejecuta el caso incluido (ej: *Realizar Pedido* `--<<include>>-->` *Validar Inventario*).\n• **Extensión (`<<extend>>`):** Relación condicional donde el comportamiento se inserta sólo si se cumple una regla específica (ej: *Pagar Compra* `<--<<extend>>--* *Aplicar Cupón de Descuento*).\n• **Generalización:** Herencia entre actores (ej: *Administrador* especializa a *Usuario*) o entre casos de uso.\n\n**Consejo:** Haz doble clic en cualquier nodo para modificar su nombre, descripción y notas.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '⏱️ Sequence Diagrams', query: 'sequence diagram' },
              { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
              { label: '📊 All Diagram Types', query: 'diagram types' },
            ]
          : [
              { label: '⏱️ Diagramas de Secuencia', query: 'diagrama de secuencia' },
              { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
              { label: '📊 Ver todos los tipos', query: 'tipos de diagramas' },
            ],
      );
      return;
    }

    // 13. Diagrama de Secuencia (Sequence)
    if (
      text.includes('secuencia') ||
      text.includes('sequence') ||
      text.includes('lifeline') ||
      text.includes('linea de vida') ||
      text.includes('línea de vida') ||
      text.includes('mensaje sincron') ||
      text.includes('mensaje asincron') ||
      text.includes('retorno') ||
      text.includes('reply') ||
      text.includes('activacion') ||
      text.includes('activación')
    ) {
      this.addBotMessage(
        isEn
          ? '### ⏱️ Sequence Diagrams (`sequence`)\n\nVisualizes dynamic temporal interaction and message passing between objects over time.\n\n**Key Elements:**\n• **Lifeline (Participant):** Header box containing the participant name/role with a vertical dashed line extending downwards representing the progression of time.\n• **Execution Specification (Activation Bar):** Slim vertical rectangle along the lifeline showing when an object has active execution control.\n• **Synchronous Message (Call):** Solid line with filled arrow (`->`). The sender blocks waiting for completion.\n• **Asynchronous Message (Signal):** Solid line with open stick arrow (`->>`). The sender continues without blocking.\n• **Return / Reply Message:** Dashed line with open arrow (`-->`). Returns computed values or control back to the caller.\n• **Creation / Destruction:** Arrows pointing directly into participant boxes to create instances, or termination markers (`X`).\n\n**Usage:**\nDrag lifelines across the horizontal axis; messages are ordered vertically in chronological order from top to bottom.'
          : '### ⏱️ Diagrama de Secuencia (`sequence`)\n\nModela la interacción dinámica y el intercambio temporal de mensajes entre objetos ordenados cronológicamente.\n\n**Elementos Clave:**\n• **Línea de Vida (*Lifeline*):** Caja superior con el nombre del objeto/rol y una línea vertical punteada que desciende representando el flujo del tiempo.\n• **Barra de Activación (*Execution Bar*):** Rectángulo vertical sobre la línea de vida que indica el periodo en el que el objeto está ejecutando una acción.\n• **Mensaje Síncrono (*Call*):** Flecha sólida con punta rellena (`->`). El emisor se detiene esperando la finalización de la operación.\n• **Mensaje Asíncrono (*Signal*):** Flecha sólida con punta abierta (`->>`). El emisor continúa inmediatamente sin bloquearse.\n• **Mensaje de Retorno (*Reply*):** Línea discontinua con punta abierta (`-->`). Devuelve el resultado o confirma el fin de la operación.\n• **Creación / Destrucción:** Flechas que apuntan a una nueva línea de vida para instanciarla, o aspas (`X`) para representar su finalización.\n\n**Uso:**\nLos objetos se disponen horizontalmente en la parte superior y el tiempo transcurre verticalmente de arriba hacia abajo.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '💬 Communication Diagrams', query: 'communication diagram' },
              { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
              { label: '📊 All Diagram Types', query: 'diagram types' },
            ]
          : [
              { label: '💬 Diagramas de Comunicación', query: 'diagrama de comunicacion' },
              { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
              { label: '📊 Ver todos los tipos', query: 'tipos de diagramas' },
            ],
      );
      return;
    }

    // 14. Diagrama de Comunicación (Communication)
    if (
      text.includes('comunicacion') ||
      text.includes('comunicación') ||
      text.includes('communication') ||
      text.includes('mensaje numerado') ||
      text.includes('secuencia numerica') ||
      text.includes('secuencia numérica') ||
      text.includes('orden numerico') ||
      text.includes('orden numérico')
    ) {
      this.addBotMessage(
        isEn
          ? '### 💬 Communication Diagrams (`communication`)\n\nFocuses on structural relationships and object collaboration network topology rather than timeline axes.\n\n**Core Concepts:**\n• **Collaborating Nodes:** Objects placed freely on the canvas, optionally annotated with stereotyping icons (`<<boundary>>`, `<<control>>`, `<<entity>>`).\n• **Communication Links:** Solid paths between nodes that represent active communication channels.\n• **Numbered Messages:** Messages placed along connection links with hierarchical sequence numbering:\n  - `1: submitForm(data)`\n  - `1.1: validateInput()`\n  - `1.2: persistRecord()`\n  - `2: notifySuccess()`\n• **Direction Arrows:** Directional arrows next to message labels specify which participant is sending the command.'
          : '### 💬 Diagrama de Comunicación (`communication`)\n\nEnfatiza la red estructural de relaciones y colaboración entre objetos, organizando el espacio libremente en vez de usar un eje temporal rígido.\n\n**Conceptos Fundamentales:**\n• **Nodos Participantes:** Objetos distribuidos en el lienzo, soportando estereotipos normativos (`<<boundary>>`, `<<control>>`, `<<entity>>`).\n• **Enlaces de Comunicación:** Rutas continuas entre los objetos por donde circulan las llamadas.\n• **Mensajes Numerados Secuencialmente:** Cada mensaje lleva un prefijo numérico jerárquico que indica el orden exacto de ejecución:\n  - `1: registrarPedido(datos)`\n  - `1.1: verificarStock()`\n  - `1.2: debitarSaldo()`\n  - `2: enviarConfirmacion()`\n• **Flechas de Dirección:** Pequeñas flechas junto al texto del mensaje que indican el sentido en el que viaja la llamada entre los participantes.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '⏱️ Sequence Diagrams', query: 'sequence diagram' },
              { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
              { label: '🎨 UML Classes & Relations', query: 'how to model classes' },
            ]
          : [
              { label: '⏱️ Diagramas de Secuencia', query: 'diagrama de secuencia' },
              { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
              { label: '🎨 Clases y Relaciones UML', query: 'como modelar clases y relaciones' },
            ],
      );
      return;
    }

    // 15. Diagrama de Análisis de Clases / Análisis Robusto (Jacobson Robustness Analysis)
    if (
      text.includes('analisis de clase') ||
      text.includes('análisis de clase') ||
      text.includes('class analysis') ||
      text.includes('robustez') ||
      text.includes('robustness') ||
      text.includes('boundary') ||
      text.includes('control') ||
      text.includes('entity') ||
      text.includes('jacobson')
    ) {
      this.addBotMessage(
        isEn
          ? '### 🔬 Robustness Analysis Diagram (`class_analysis`)\n\nBridging the gap between Use Cases (requirements) and Detailed Class Design using Ivar Jacobson\'s Robustness Analysis.\n\n**The Three Canonical Stereotypes:**\n• **1. Boundary (Frontera):** Mediates interaction between external actors and system internals (screens, API endpoints, web forms, reports). Drawn as a circle with a vertical tangent line on the left.\n• **2. Control:** Coordinates business logic, orchestrates transactional workflows, and governs rules. Drawn as a circle topped by an arrow.\n• **3. Entity:** Encapsulates persistent business domain data (e.g. `Client`, `Order`, `Invoice`). Drawn as a circle with a flat horizontal base.\n\n**Golden Rules of Robustness:**\n• **Actors** only interact with **Boundary** classes.\n• **Boundary** classes only talk to **Control** classes (or Actors).\n• **Control** classes can talk to **Boundary**, other **Control**, and **Entity** classes.\n• **Entity** classes only interact with **Control** classes (two Entities should not invoke each other directly in analysis).'
          : '### 🔬 Diagrama de Análisis de Clases / Robustez (`class_analysis`)\n\nConecta el puente metodológico entre los Casos de Uso (requerimientos) y el Diseño Detallado de Clases aplicando el Análisis de Robustez de Ivar Jacobson.\n\n**Los Tres Estereotipos Canónicos:**\n• **1. Boundary (Frontera / Interfaz):** Media entre los actores externos y el interior del sistema (pantallas, vistas, controladores API, diálogos). Representado por un círculo con una barra vertical tangente a la izquierda.\n• **2. Control (Controlador / Lógica de Negocio):** Orquesta la lógica del caso de uso, coordina transacciones y valida reglas del negocio. Representado por un círculo con una flecha directriz superior.\n• **3. Entity (Entidad / Dominio Persistente):** Almacena y gestiona los datos de dominio duraderos (`Cliente`, `Factura`, `Producto`). Representado por un círculo sobre una base horizontal.\n\n**Reglas de Oro del Análisis de Robustez:**\n• Los **Actores** solo pueden conectarse con clases **Boundary**.\n• Las clases **Boundary** solo se comunican con clases **Control** (o con Actores).\n• Las clases **Control** pueden comunicarse con **Boundary**, otros **Control** y clases **Entity**.\n• Las clases **Entity** solo interactúan con clases **Control** (dos entidades no deben comunicarse directamente en la fase de análisis).\n\n**En UML/ER Studio:** En este diagrama los estereotipos se posicionan centralmente en la cabecera del nodo y son completamente exportables a Enterprise Architect XMI.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '👤 Use Case Diagrams', query: 'use case diagram' },
              { label: '🎨 Detailed Class Diagrams', query: 'how to model classes' },
              { label: '⚡ Generate Spring Boot code', query: 'how to generate code' },
            ]
          : [
              { label: '👤 Casos de Uso', query: 'diagrama de casos de uso' },
              { label: '🎨 Diagrama de Clases Detallado', query: 'como modelar clases y relaciones' },
              { label: '⚡ Generar código Spring Boot', query: 'como generar codigo' },
            ],
      );
      return;
    }

    // 16. Diagramas Arquitectónicos (Paquetes, Componentes y Despliegue)
    if (
      text.includes('paquete') ||
      text.includes('package') ||
      text.includes('componente') ||
      text.includes('component') ||
      text.includes('despliegue') ||
      text.includes('deployment') ||
      text.includes('nodo') ||
      text.includes('artefacto')
    ) {
      this.addBotMessage(
        isEn
          ? '### 📦 Architectural Diagrams (Packages, Components & Deployment)\n\nModel high-level system topology, modular subsystems, and physical infrastructure:\n\n• **Package Diagrams (`package`):** Group classes and models into folder-like modules with dependency arrows (`<<import>>`, `<<access>>`) to organize large-scale architectures.\n• **Component Diagrams (`component`):** Represent deployable executable software blocks with provided interfaces (ball/lollipop) and required interfaces (socket) forming assembly connectors.\n• **Deployment Diagrams (`deployment`):** Depict hardware nodes (servers, devices, cloud clusters) and the software artifacts running inside them.'
          : '### 📦 Diagramas Arquitectónicos (Paquetes, Componentes y Despliegue)\n\nModela la topología de alto nivel, la modularidad de subsistemas y la infraestructura física:\n\n• **Diagrama de Paquetes (`package`):** Agrupa clases, modelos y subsistemas en carpetas modulares con flechas de dependencia (`<<import>>`, `<<access>>`), organizando arquitecturas complejas.\n• **Diagrama de Componentes (`component`):** Representa módulos de software ejecutables con interfaces provistas (lollipop) e interfaces requeridas (socket) formando conectores de ensamble (*assembly*).\n• **Diagrama de Despliegue (`deployment`):** Mapea los nodos físicos y de red (servidores de aplicación, clústeres cloud, contenedores Docker, bases de datos) y los artefactos que se ejecutan en ellos.',
        undefined,
        undefined,
        isEn
          ? [
              { label: '📊 All Diagram Types', query: 'diagram types' },
              { label: '⚡ Generate Fullstack Code', query: 'how to generate code' },
            ]
          : [
              { label: '📊 Ver todos los tipos', query: 'tipos de diagramas' },
              { label: '⚡ Generar código Fullstack', query: 'como generar codigo' },
            ],
      );
      return;
    }

    // 17. Respuesta por Defecto (Fallback Inteligente con Recomendaciones)
    this.addBotMessage(
      isEn
        ? `I understand your query regarding: "${rawInput}".\n\nHere are the primary topics from the **Interactive Manual** to assist you right away. Select any quick option below:`
        : `Entiendo tu consulta sobre: "${rawInput}".\n\nAquí tienes los temas principales del **Manual Interactivo** para ayudarte de inmediato. Selecciona cualquiera de las opciones rápidas:`,
      undefined,
      undefined,
      isEn
        ? [
            { label: '🚀 Start Step-by-Step Tour', query: 'start tour' },
            { label: '📊 Supported Diagram Types', query: 'diagram types' },
            { label: '👤 Use Case Diagrams', query: 'use case diagram' },
            { label: '⏱️ Sequence Diagrams', query: 'sequence diagram' },
            { label: '🔬 Robustness Class Analysis', query: 'class analysis diagram' },
            { label: '🐳 Docker & Gradle Run Commands', query: 'run commands' },
            { label: '⚡ Generate Spring Boot & Flutter', query: 'how to generate code' },
          ]
        : [
            { label: '🚀 Iniciar Tour Guiado Paso a Paso', query: 'iniciar tour' },
            { label: '📊 Tipos de Diagramas Soportados', query: 'tipos de diagramas' },
            { label: '👤 Diagramas de Casos de Uso', query: 'diagrama de casos de uso' },
            { label: '⏱️ Diagramas de Secuencia', query: 'diagrama de secuencia' },
            { label: '🔬 Análisis de Clases (Robustez)', query: 'diagrama de analisis de clases' },
            { label: '🐳 Comandos para Correr Docker y Gradle', query: 'comandos de ejecucion' },
            { label: '⚡ Generar Código Spring Boot y Flutter', query: 'como generar codigo' },
          ],
    );
  }
}
