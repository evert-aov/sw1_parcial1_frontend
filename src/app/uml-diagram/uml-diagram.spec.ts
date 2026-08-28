import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UmlDiagram } from './uml-diagram';

describe('UmlDiagram', () => {
  let component: UmlDiagram;
  let fixture: ComponentFixture<UmlDiagram>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UmlDiagram],
    }).compileComponents();

    fixture = TestBed.createComponent(UmlDiagram);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
