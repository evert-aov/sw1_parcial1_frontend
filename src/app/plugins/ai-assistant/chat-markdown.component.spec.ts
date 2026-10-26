import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatMarkdownComponent, parseChatMarkdown, parseInline } from './chat-markdown.component';

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

  it('parses inline bold, code, italic and escaped multiplicity asterisks correctly', () => {
    const tokens = parseInline(
      'La relación entre `Cliente` y `Pedido` es una **asociación** con multiplicidad **\\*** y *detalle*.'
    );
    expect(tokens).toEqual([
      { kind: 'text', text: 'La relación entre ' },
      { kind: 'code', text: 'Cliente' },
      { kind: 'text', text: ' y ' },
      { kind: 'code', text: 'Pedido' },
      { kind: 'text', text: ' es una ' },
      { kind: 'bold', text: 'asociación' },
      { kind: 'text', text: ' con multiplicidad ' },
      { kind: 'bold', text: '*' },
      { kind: 'text', text: ' y ' },
      { kind: 'italic', text: 'detalle' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('renders bold, code and bullet points with rich elements in the component', () => {
    const fixture = TestBed.createComponent(ChatMarkdownComponent);
    fixture.componentRef.setInput(
      'content',
      '• **Cliente (Source)**: `Cliente` con multiplicidad **1**.'
    );
    fixture.detectChanges();

    const codeEl = fixture.nativeElement.querySelector('code');
    const strongEls = fixture.nativeElement.querySelectorAll('strong');
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toBe('Cliente');
    expect(strongEls.length).toBe(2);
    expect(strongEls[0]?.textContent).toBe('Cliente (Source)');
    expect(strongEls[1]?.textContent).toBe('1');
    fixture.destroy();
  });
});
