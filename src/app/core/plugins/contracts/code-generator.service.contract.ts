import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { Observable } from 'rxjs';
export interface GeneratedFile {
  path: string;
  filename: string;
  language: string;
  layer:
    | 'entity'
    | 'repository'
    | 'service'
    | 'controller'
    | 'dto'
    | 'migration'
    | 'config'
    | 'docker'
    | 'docs';
  content: string;
}
export interface CodeGenerationPreviewResponse {
  projectName: string;
  totalFiles: number;
  files: GeneratedFile[];
}
export interface GenerateCodeRequest {
  diagramId?: string;
  packageName?: string;
  artifactId?: string;
  groupId?: string;
  projectName?: string;
  javaVersion?: string;
  springBootVersion?: string;
  databaseName?: string;
  databaseUser?: string;
  databasePassword?: string;
  databasePort?: number;
  serverPort?: number;
  platform?: 'all' | 'spring-boot' | 'flutter';
  nodes?: any[];
  connections?: any[];
}
export interface CodeGeneratorService {
  readonly isGenerating: import('@angular/core').WritableSignal<boolean>;
  readonly previewData: import('@angular/core').WritableSignal<CodeGenerationPreviewResponse | null>;
  previewFromDiagramId(
    diagramId: string,
    payload: GenerateCodeRequest,
  ): Observable<CodeGenerationPreviewResponse>;
  downloadZipFromDiagramId(diagramId: string, payload: GenerateCodeRequest): Observable<Blob>;
}
export const CodeGeneratorService: InjectionToken<CodeGeneratorService> =
  new InjectionToken<CodeGeneratorService>('CodeGeneratorService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(CodeGeneratorService),
  });
