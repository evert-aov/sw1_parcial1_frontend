export * from './communication-gl.component';
export * from './boundary-gl.component';
export * from './control-gl.component';
export * from './entity-gl.component';
export * from './actor-gl.component';

import { CommunicationGlComponent } from './communication-gl.component';
import { BoundaryGlComponent } from './boundary-gl.component';
import { ControlGlComponent } from './control-gl.component';
import { EntityGlComponent } from './entity-gl.component';
import { ActorGlComponent } from './actor-gl.component';

export const UML_WEBGL_COMPONENTS = [
  CommunicationGlComponent,
  BoundaryGlComponent,
  ControlGlComponent,
  EntityGlComponent,
  ActorGlComponent,
] as const;
