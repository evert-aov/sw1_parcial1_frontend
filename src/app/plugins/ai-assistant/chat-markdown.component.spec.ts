import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatMarkdownComponent, parseChatMarkdown } from './chat-markdown.component';

describe('Safe chat Markdown', () => {
  it('preserves fenced code and lists', () => {
    expect(parseChatMarkdown('# Heading\n- First\n```ts\nconst x = 1;\n```')).toEqual([
      { kind: 'heading', text: 'Heading' }, { kind: 'list', text: 'First' }, { kind: 'code', text: 'const x = 1;' },
    ]);
  });

  it('renders model HTML as literal text', () => {
    const fixture = TestBed.createComponent(ChatMarkdownComponent);
    fixture.componentRef.setInput('content', '<img src=x onerror=alert(1)>\n<script>alert(1)</script>');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img');
    fixture.destroy();
  });
});
