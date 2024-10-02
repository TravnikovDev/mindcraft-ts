export const goToPlayerFunctionSchema = {
  name: "goToPlayer",
  description: "Move to a specific player's location.",
  parameters: {
    type: "object",
    properties: {
      playerName: {
        type: "string",
        description: "Name of the player to go to.",
      },
      distance: {
        type: "number",
        description: "Distance to maintain from the player (optional).",
        minimum: 0,
      },
    },
    required: ["playerName"],
  },
};

export const goToPositionFunctionSchema = {
  name: "goToPosition",
  description: "Move to specific coordinates.",
  parameters: {
    type: "object",
    properties: {
      x: { type: "number", description: "X coordinate." },
      y: { type: "number", description: "Y coordinate." },
      z: { type: "number", description: "Z coordinate." },
    },
    required: ["x", "y", "z"],
  },
};

export const followPlayerFunctionSchema = {
  name: "followPlayer",
  description: "Follow a player at a certain distance.",
  parameters: {
    type: "object",
    properties: {
      playerName: {
        type: "string",
        description: "Name of the player to follow.",
      },
      distance: {
        type: "number",
        description: "Distance to maintain from the player (optional).",
        minimum: 0,
      },
    },
    required: ["playerName"],
  },
};

export const moveAwayFunctionSchema = {
  name: "moveAway",
  description: "Move away from the current location or an entity.",
  parameters: {
    type: "object",
    properties: {
      distance: {
        type: "number",
        description: "Distance to move away.",
        minimum: 1,
      },
    },
    required: ["distance"],
  },
};
