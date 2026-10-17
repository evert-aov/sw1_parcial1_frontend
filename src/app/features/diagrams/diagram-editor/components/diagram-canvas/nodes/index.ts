import { UmlClassNodeComponent } from './uml-class-node/uml-class-node.component';
import { UmlActorNodeComponent } from './uml-actor-node/uml-actor-node.component';
import { UmlLifelineNodeComponent } from './uml-lifeline-node/uml-lifeline-node.component';
import { UmlPackageNodeComponent } from './uml-package-node/uml-package-node.component';
import { UmlUseCaseNodeComponent } from './uml-use-case-node/uml-use-case-node.component';
import { UmlRobustnessNodeComponent } from './uml-robustness-node/uml-robustness-node.component';
import { UmlComponentNodeComponent } from './uml-component-node/uml-component-node.component';
import { UmlDeploymentNodeComponent } from './uml-deployment-node/uml-deployment-node.component';

export {
  UmlClassNodeComponent,
  UmlActorNodeComponent,
  UmlLifelineNodeComponent,
  UmlPackageNodeComponent,
  UmlUseCaseNodeComponent,
  UmlRobustnessNodeComponent,
  UmlComponentNodeComponent,
  UmlDeploymentNodeComponent,
};

export const UML_CANVAS_NODE_COMPONENTS = [
  UmlClassNodeComponent,
  UmlActorNodeComponent,
  UmlLifelineNodeComponent,
  UmlPackageNodeComponent,
  UmlUseCaseNodeComponent,
  UmlRobustnessNodeComponent,
  UmlComponentNodeComponent,
  UmlDeploymentNodeComponent,
] as const;

// Domain Logics por tipo de nodo UML
export * from './uml-actor-node/uml-actor.logic';
export * from './uml-class-node/uml-class.logic';
export * from './uml-component-node/uml-component.logic';
export * from './uml-deployment-node/uml-deployment.logic';
export * from './uml-lifeline-node/uml-lifeline.logic';
export * from './uml-package-node/uml-package.logic';
export * from './uml-robustness-node/uml-robustness.logic';
export * from './uml-use-case-node/uml-use-case.logic';
