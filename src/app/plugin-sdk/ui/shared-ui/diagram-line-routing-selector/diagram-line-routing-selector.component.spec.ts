import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiagramLineRoutingSelectorComponent } from './diagram-line-routing-selector.component';
import { TranslationService } from '../../../../core/i18n/index';

describe('DiagramLineRoutingSelectorComponent', () => {
  let component: DiagramLineRoutingSelectorComponent;
  let fixture: ComponentFixture<DiagramLineRoutingSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramLineRoutingSelectorComponent],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            currentLang: () => 'es',
            translate: (key: string) => key,
            t: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramLineRoutingSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente con estilos por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.lineStyles.length).toBeGreaterThan(0);
    expect(component.lineStyles.some((s) => s.id === 'straight')).toBe(true);
  });

  it('debe emitir styleChange y applyToAll al cambiar el select', () => {
    let emittedStyle: string | null = null;
    let appliedStyle: string | null = null;
    component.styleChange.subscribe((s) => (emittedStyle = s));
    component.applyToAll.subscribe((s) => (appliedStyle = s));

    const select = fixture.nativeElement.querySelector('select');
    select.value = 'straight';
    select.dispatchEvent(new Event('change'));

    expect(emittedStyle).toBe('straight');
    expect(appliedStyle).toBe('straight');
    expect(component.selectedStyle).toBe('straight');
  });

  it('debe emitir applyToAll con el estilo actual al pulsar onApplyToAll', () => {
    component.selectedStyle = 'straight';
    let appliedStyle: string | null = null;
    component.applyToAll.subscribe((s) => (appliedStyle = s));

    component.onApplyToAll();
    expect(appliedStyle).toBe('straight');
  });
});
