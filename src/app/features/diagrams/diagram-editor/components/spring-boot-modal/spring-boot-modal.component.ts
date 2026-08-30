import {
  Component,
  input,
  output,
  signal,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBolt,
  heroCodeBracket,
  heroCube,
  heroDocumentText,
  heroFolder,
  heroServer,
  heroCommandLine,
  heroArrowDownTray,
  heroClipboardDocument,
  heroCheck,
  heroXMark,
  heroArrowPath,
  heroCpuChip,
  heroSparkles,
  heroCircleStack,
  heroAdjustmentsHorizontal,
} from '@ng-icons/heroicons/outline';
import {
  CodeGeneratorService,
  GeneratedFile,
  GenerateCodeRequest,
} from '../../../../../core/services/code-generator.service';
import { UmlClassNode, UmlConnection } from '../../../../../core/models/diagram.model';

@Component({
  standalone: true,
  selector: 'app-spring-boot-modal',
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      heroBolt,
      heroCodeBracket,
      heroCube,
      heroDocumentText,
      heroFolder,
      heroServer,
      heroCommandLine,
      heroArrowDownTray,
      heroClipboardDocument,
      heroCheck,
      heroXMark,
      heroArrowPath,
      heroCpuChip,
      heroSparkles,
      heroCircleStack,
      heroAdjustmentsHorizontal,
    }),
  ],
  templateUrl: './spring-boot-modal.component.html',
})
export class SpringBootModalComponent implements OnInit {
  private readonly codegenService = inject(CodeGeneratorService);

  readonly isOpen = input<boolean>(false);
  readonly diagramId = input<string | null>(null);
  readonly diagramName = input<string>('Diagrama UML');
  readonly nodes = input<UmlClassNode[]>([]);
  readonly connections = input<UmlConnection[]>([]);

  readonly closeModal = output<void>();

  // Configuración del Proyecto
  packageName = signal<string>('com.uagrm.studio');
  artifactId = signal<string>('spring-boot-uml-api');
  projectName = signal<string>('Spring Boot UML Microservice');
  javaVersion = signal<string>('21');
  databaseName = signal<string>('uml_studio_db');
  databaseUser = signal<string>('postgres');
  databasePassword = signal<string>('postgres');
  serverPort = signal<number>(8080);
  databasePort = signal<number>(5432);

  // Pestaña activa del explorador
  activeCategory = signal<string>('all');
  selectedFile = signal<GeneratedFile | null>(null);
  isCopied = signal<boolean>(false);
  isGenerating = signal<boolean>(false);
  isDownloading = signal<boolean>(false);

  // Archivos generados
  files = signal<GeneratedFile[]>([]);

  readonly filteredFiles = computed(() => {
    const cat = this.activeCategory();
    const all = this.files();
    if (cat === 'all') return all;
    return all.filter((f) => f.layer === cat);
  });

  readonly totalClasses = computed(() => {
    return this.nodes().filter((n) => !n.isAnchor).length;
  });

  readonly totalRelations = computed(() => {
    return this.connections().length;
  });

  ngOnInit(): void {
    if (this.diagramName()) {
      const clean = this.diagramName().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      this.artifactId.set(clean || 'spring-boot-uml-api');
      this.projectName.set(this.diagramName());
    }
    this.generatePreview();
  }

  generatePreview(): void {
    this.isGenerating.set(true);

    const payload: GenerateCodeRequest = {
      diagramId: this.diagramId() || undefined,
      packageName: this.packageName(),
      artifactId: this.artifactId(),
      projectName: this.projectName(),
      javaVersion: this.javaVersion(),
      databaseName: this.databaseName(),
      databaseUser: this.databaseUser(),
      databasePassword: this.databasePassword(),
      serverPort: this.serverPort(),
      databasePort: this.databasePort(),
      nodes: this.nodes(),
      connections: this.connections(),
    };

    const request$ = this.diagramId()
      ? this.codegenService.previewFromDiagramId(this.diagramId()!, payload)
      : this.codegenService.preview(payload);

    request$.subscribe({
      next: (res) => {
        this.files.set(res.files || []);
        if (res.files && res.files.length > 0) {
          // Seleccionar por defecto la primera entidad o el primer archivo
          const firstEntity = res.files.find((f) => f.layer === 'entity') || res.files[0];
          this.selectedFile.set(firstEntity);
        }
        this.isGenerating.set(false);
      },
      error: () => {
        this.isGenerating.set(false);
      },
    });
  }

  selectFile(file: GeneratedFile): void {
    this.selectedFile.set(file);
    this.isCopied.set(false);
  }

  copyCode(): void {
    const file = this.selectedFile();
    if (!file) return;

    navigator.clipboard.writeText(file.content).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    });
  }

  downloadZip(): void {
    this.isDownloading.set(true);

    const payload: GenerateCodeRequest = {
      diagramId: this.diagramId() || undefined,
      packageName: this.packageName(),
      artifactId: this.artifactId(),
      projectName: this.projectName(),
      javaVersion: this.javaVersion(),
      databaseName: this.databaseName(),
      databaseUser: this.databaseUser(),
      databasePassword: this.databasePassword(),
      serverPort: this.serverPort(),
      databasePort: this.databasePort(),
      nodes: this.nodes(),
      connections: this.connections(),
    };

    const request$ = this.diagramId()
      ? this.codegenService.downloadZipFromDiagramId(this.diagramId()!, payload)
      : this.codegenService.downloadZip(payload);

    request$.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.artifactId()}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isDownloading.set(false);
      },
      error: () => {
        this.isDownloading.set(false);
        alert('Error al descargar el archivo ZIP.');
      },
    });
  }

  getLayerBadge(layer: string): { label: string; class: string } {
    switch (layer) {
      case 'entity':
        return { label: 'Entidad JPA', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'repository':
        return { label: 'Repositorio', class: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'dto':
        return { label: 'DTO', class: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'service':
        return { label: 'Servicio', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'controller':
        return { label: 'REST Controller', class: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'migration':
        return { label: 'Flyway SQL', class: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'docker':
        return { label: 'Docker Compose', class: 'bg-sky-100 text-sky-800 border-sky-300' };
      case 'config':
        return { label: 'Configuración', class: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'docs':
        return { label: 'Documentación', class: 'bg-teal-100 text-teal-800 border-teal-300' };
      default:
        return { label: layer, class: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  }
}
