import {
  placeBlockFunctionSchema,
  buildStructureFunctionSchema,
} from "./buildingAndPlacement";
import {
  attackEntityFunctionSchema,
  defendSelfFunctionSchema,
  huntEntityFunctionSchema,
} from "./combatAndInteraction";
import {
  chatFunctionSchema,
  nearbyBlocksFunctionSchema,
  nearbyEntitiesFunctionSchema,
} from "./communicationAndStatus";
import {
  collectBlocksFunctionSchema,
  collectBlockFunctionSchema,
  pickupNearbyItemsFunctionSchema,
  craftItemFunctionSchema,
  smeltItemFunctionSchema,
} from "./itemCollectionAndManagement";
import {
  rememberHereFunctionSchema,
  goToPlaceFunctionSchema,
  setGoalFunctionSchema,
  endGoalFunctionSchema,
} from "./memoryAndGoals";
import { setModeFunctionSchema } from "./modeManagement";
import {
  goToPlayerFunctionSchema,
  goToPositionFunctionSchema,
  followPlayerFunctionSchema,
  moveAwayFunctionSchema,
} from "./movementAndNavigation";

export default [
  // Movement and Navigation
  goToPlayerFunctionSchema,
  goToPositionFunctionSchema,
  followPlayerFunctionSchema,
  moveAwayFunctionSchema,
  // Item Collection and Management
  collectBlocksFunctionSchema,
  collectBlockFunctionSchema,
  pickupNearbyItemsFunctionSchema,
  craftItemFunctionSchema,
  smeltItemFunctionSchema,
  // Building and Placement
  placeBlockFunctionSchema,
  buildStructureFunctionSchema,
  // Combat and Interaction
  attackEntityFunctionSchema,
  defendSelfFunctionSchema,
  huntEntityFunctionSchema,
  // Communication and Status
  chatFunctionSchema,
  nearbyBlocksFunctionSchema,
  nearbyEntitiesFunctionSchema,
  // Memory and Goals
  rememberHereFunctionSchema,
  goToPlaceFunctionSchema,
  setGoalFunctionSchema,
  endGoalFunctionSchema,
  // Mode Management
  setModeFunctionSchema,
];
