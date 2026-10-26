import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tipos de tokens enriquecidos para formato en línea en Markdown. */
export interface InlineToken {
  kind: 'text' | 'bold' | 'italic' | 'bold-italic' | 'code';
  text: string;
}

/** Bloque de Markdown seguro: nunca se interpreta HTML recibido del modelo. */
export interface MarkdownBlock {
  kind: 'text' | 'code' | 'heading' | 'list';
  text: string;
  isSub?: boolean;
}

/**
 * Busca el delimitador de cierre asegurando que no esté escapado con contrabarra impar.
 */
function findClosingDelimiter(text: string, delim: string, fromIndex: number): number {
  let i = fromIndex;
  while (i < text.length) {
    if (text.startsWith(delim, i)) {
      let backslashCount = 0;
      let k = i - 1;
      while (k >= fromIndex && text[k] === '\\') {
        backslashCount++;
        k--;
      }
      if (backslashCount % 2 === 0) {
        return i;
      }
    }
    i++;
  }
  return -1;
}

/**
 * Desescapa caracteres especiales de Markdown como \*, \_, \` y \\.
 */
function unescapeDelimiters(str: string): string {
  return str.replace(/\\([*_`~\\])/g, '$1');
}

/**
 * Parsea el texto en línea extrayendo negritas (**), cursivas (*), negrita-cursiva (***)
 * y código en línea (`...`) con seguridad total contra inyecciones XSS.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;
  const len = text.length;
  let currentText = '';

  const flushText = () => {
    if (currentText) {
      tokens.push({ kind: 'text', text: currentText });
      currentText = '';
    }
  };

  while (index < len) {
    // 1. Delimitadores escapados explícitamente fuera de spans
    if (text[index] === '\\' && index + 1 < len) {
      const next = text[index + 1];
      if (next === '*' || next === '_' || next === '`' || next === '\\' || next === '~') {
        currentText += next;
        index += 2;
        continue;
      }
    }

    // 2. Código en línea: `...`
    if (text[index] === '`') {
      const closeIdx = text.indexOf('`', index + 1);
      if (closeIdx !== -1) {
        flushText();
        const codeContent = text.slice(index + 1, closeIdx);
        tokens.push({ kind: 'code', text: codeContent });
        index = closeIdx + 1;
        continue;
      }
    }

    // 3. Negrita-cursiva: ***...*** o ___...___
    if (
      (text.startsWith('***', index) || text.startsWith('___', index)) &&
      index + 3 < len
    ) {
      const delim = text.slice(index, index + 3);
      const closeIdx = findClosingDelimiter(text, delim, index + 3);
      if (closeIdx !== -1) {
        flushText();
        const inner = unescapeDelimiters(text.slice(index + 3, closeIdx));
        tokens.push({ kind: 'bold-italic', text: inner });
        index = closeIdx + 3;
        continue;
      }
    }

    // 4. Negrita: **...** o __...__
    if (
      (text.startsWith('**', index) || text.startsWith('__', index)) &&
      index + 2 < len
    ) {
      const delim = text.slice(index, index + 2);
      const closeIdx = findClosingDelimiter(text, delim, index + 2);
      if (closeIdx !== -1) {
        flushText();
        const inner = unescapeDelimiters(text.slice(index + 2, closeIdx));
        tokens.push({ kind: 'bold', text: inner });
        index = closeIdx + 2;
        continue;
      }
    }

    // 5. Cursiva: *...* o _..._
    if (text[index] === '*' || text[index] === '_') {
      const delim = text[index];
      const isWordInternal =
        delim === '_' &&
        index > 0 &&
        /\w/.test(text[index - 1]) &&
        index + 1 < len &&
        /\w/.test(text[index + 1]);

      if (!isWordInternal) {
        const closeIdx = findClosingDelimiter(text, delim, index + 1);
        if (closeIdx !== -1) {
          flushText();
          const inner = unescapeDelimiters(text.slice(index + 1, closeIdx));
          tokens.push({ kind: 'italic', text: inner });
          index = closeIdx + 1;
          continue;
        }
      }
    }

    currentText += text[index];
    index++;
  }

  flushText();
  return tokens;
}

/** Interpreta bloques básicos; la interpolación de Angular escapa cualquier HTML incluido. */
export function parseChatMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let code: string[] | null = null;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = null;
      } else {
        code = [];
      }
    } else if (code) {
      code.push(line);
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,6}\s+/, '') });
    } else if (/^\s*(?:[-*•]\s*|\d+\.\s+)/.test(line)) {
      const isSub = /^\s{2,}/.test(line);
      const text = line.replace(/^\s*(?:[-*•]\s*|\d+\.\s+)/, '');
      blocks.push(isSub ? { kind: 'list', text, isSub: true } : { kind: 'list', text });
    } else {
      blocks.push({ kind: 'text', text: line });
    }
  }
  if (code) {
    blocks.push({ kind: 'code', text: code.join('\n') });
  }
  return blocks;
}

/** Renderiza tokens individuales respetando los estilos de la tipografía y modo oscuro. */
@Component({
  selector: 'app-chat-markdown-tokens',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (token of tokens(); track $index) {
      @switch (token.kind) {
        @case ('bold') {
          <strong class="font-bold text-slate-900 dark:text-white">{{ token.text }}</strong>
        }
        @case ('italic') {
          <em class="italic text-slate-800 dark:text-slate-200">{{ token.text }}</em>
        }
        @case ('bold-italic') {
          <strong class="font-bold italic text-slate-900 dark:text-white">{{ token.text }}</strong>
        }
        @case ('code') {
          <code class="px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11.5px] font-medium bg-slate-200/80 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-300/80 dark:border-slate-700 select-all">{{ token.text }}</code>
        }
        @default {
          <span>{{ token.text }}</span>
        }
      }
    }
  `,
})
export class ChatMarkdownTokensComponent {
  readonly tokens = input.required<InlineToken[]>();
}

/** Renderiza Markdown enriquecido y seguro sin innerHTML, URLs ejecutables ni riesgo XSS. */
@Component({
  selector: 'app-chat-markdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatMarkdownTokensComponent],
  template: `
    @for (block of parsedBlocks(); track $index) {
      @switch (block.kind) {
        @case ('code') {
          <div class="my-2.5 rounded-lg overflow-hidden border border-slate-300/70 dark:border-slate-800 bg-slate-900 text-slate-100 text-xs font-mono shadow-2xs">
            <pre class="p-3 overflow-x-auto leading-relaxed"><code>{{ block.text }}</code></pre>
          </div>
        }
        @case ('heading') {
          <h4 class="mt-3 mb-1 font-bold text-slate-900 dark:text-white text-sm">
            <app-chat-markdown-tokens [tokens]="block.tokens" />
          </h4>
        }
        @case ('list') {
          <div class="flex items-start gap-2 my-1.5 leading-relaxed" [class.pl-4]="block.isSub" [class.pl-1]="!block.isSub">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-2 shrink-0"></span>
            <div class="flex-1 break-words">
              <app-chat-markdown-tokens [tokens]="block.tokens" />
            </div>
          </div>
        }
        @default {
          @if (!block.text.trim()) {
            <div class="h-2"></div>
          } @else {
            <p class="leading-relaxed break-words my-1 text-slate-800 dark:text-slate-200">
              <app-chat-markdown-tokens [tokens]="block.tokens" />
            </p>
          }
        }
      }
    }
  `,
})
export class ChatMarkdownComponent {
  readonly content = input('');
  readonly blocks = computed(() => parseChatMarkdown(this.content()));
  readonly parsedBlocks = computed(() =>
    this.blocks().map((b) => ({
      ...b,
      tokens: b.kind !== 'code' ? parseInline(b.text) : [],
    }))
  );
}
