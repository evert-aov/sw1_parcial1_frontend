import { nodePlugin } from '../plugins/uml-deployment-node/node.plugin';
import { classPlugin } from '../plugins/uml-class-node/class.plugin';
import { actorPlugin } from '../plugins/uml-actor-node/actor.plugin';
import { use_casePlugin } from '../plugins/uml-use-case-node/use_case.plugin';
import { packagePlugin } from '../plugins/uml-package-node/package.plugin';
import { boundary_boxPlugin } from '../plugins/uml-package-node/boundary_box.plugin';
import { boundaryPlugin } from '../plugins/uml-robustness-node/boundary.plugin';
import { controlPlugin } from '../plugins/uml-robustness-node/control.plugin';
import { entityPlugin } from '../plugins/uml-robustness-node/entity.plugin';
import { lifelinePlugin } from '../plugins/uml-lifeline-node/lifeline.plugin';
import { componentPlugin } from '../plugins/uml-component-node/component.plugin';
import { devicePlugin } from '../plugins/uml-deployment-node/device.plugin';
import { executionEnvironmentPlugin } from '../plugins/uml-deployment-node/executionEnvironment.plugin';
import { notePlugin } from '../plugins/uml-note-node/note.plugin';
import { combinedFragmentPlugin } from '../plugins/uml-combined-fragment-node/combined_fragment.plugin';
export const NODE_PLUGINS = [
  nodePlugin,
  classPlugin,
  actorPlugin,
  use_casePlugin,
  packagePlugin,
  boundary_boxPlugin,
  boundaryPlugin,
  controlPlugin,
  entityPlugin,
  lifelinePlugin,
  componentPlugin,
  devicePlugin,
  executionEnvironmentPlugin,
  notePlugin,
  combinedFragmentPlugin,
];
