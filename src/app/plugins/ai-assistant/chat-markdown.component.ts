import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Bloque de Markdown seguro: nunca se interpreta HTML recibido del modelo. */
export interface MarkdownBlock { kind: 'text' | 'code' | 'heading' | 'list'; text: string }

/** Interpreta bloques básicos; la interpolación de Angular escapa cualquier HTML incluido. */
export function parseChatMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let code: string[] | null = null;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) { blocks.push({ kind: 'code', text: code.join('\n') }); code = null; }
      else code = [];
    } else if (code) code.push(line);
    else if (/^#{1,6}\s/.test(line)) blocks.push({ kind: 'heading', text: line.replace(/^#{1,6}\s+/, '') });
    else if (/^\s*([-*]|\d+\.)\s/.test(line)) blocks.push({ kind: 'list', text: line.replace(/^\s*([-*]|\d+\.)\s+/, '') });
    else blocks.push({ kind: 'text', text: line });
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}

/** Renderiza Markdown reducido sin innerHTML, URLs ejecutables ni sanitización desactivada. */
@Component({ selector: 'app-chat-markdown', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (block of blocks(); track $index) {
    @switch (block.kind) {
      @case ('code') { <pre class="overflow-x-auto rounded bg-black/10 p-2 text-xs"><code>{{ block.text }}</code></pre> }
      @case ('heading') { <p class="mt-2 font-bold">{{ block.text }}</p> }
      @case ('list') { <p class="pl-3 whitespace-pre-wrap">• {{ block.text }}</p> }
      @default { <p class="whitespace-pre-wrap break-words min-h-2">{{ block.text }}</p> }
    }
  }` })
export class ChatMarkdownComponent {
  readonly content = input('');
  readonly blocks = computed(() => parseChatMarkdown(this.content()));
}
