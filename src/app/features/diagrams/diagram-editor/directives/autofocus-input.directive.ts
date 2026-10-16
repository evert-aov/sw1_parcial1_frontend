import { Directive, AfterViewInit, ElementRef, inject } from '@angular/core';

@Directive({
  selector: 'input[appAutofocusInput]',
  standalone: true,
})
export class AutofocusInputDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLInputElement>);

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    const focusAndSelect = () => {
      try {
        input.focus({ preventScroll: true });
        input.select();
      } catch (_) {}
    };

    focusAndSelect();
    requestAnimationFrame(() => {
      focusAndSelect();
      setTimeout(focusAndSelect, 40);
    });
  }
}
