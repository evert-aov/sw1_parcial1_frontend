export * from './actor-svg.component';
export * from './boundary-svg.component';
export * from './control-svg.component';
export * from './entity-svg.component';
export * from './directory-svg.component';
export * from './table-svg.component';
export * from './use-case-svg.component';
export * from './lifeline-svg.component';
export * from './relationship-svg.component';

import { ActorSvgComponent } from './actor-svg.component';
import { BoundarySvgComponent } from './boundary-svg.component';
import { ControlSvgComponent } from './control-svg.component';
import { EntitySvgComponent } from './entity-svg.component';
import { DirectorySvgComponent } from './directory-svg.component';
import { TableSvgComponent } from './table-svg.component';
import { UseCaseSvgComponent } from './use-case-svg.component';
import { LifelineSvgComponent } from './lifeline-svg.component';
import { RelationshipSvgComponent } from './relationship-svg.component';

/**
 * Array containing all UML 2.5 SVG standalone components for convenient bulk import:
 * imports: [...UML_SVG_COMPONENTS]
 */
export const UML_SVG_COMPONENTS = [
  ActorSvgComponent,
  BoundarySvgComponent,
  ControlSvgComponent,
  EntitySvgComponent,
  DirectorySvgComponent,
  TableSvgComponent,
  UseCaseSvgComponent,
  LifelineSvgComponent,
  RelationshipSvgComponent
] as const;
