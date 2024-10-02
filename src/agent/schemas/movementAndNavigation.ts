import { z } from "zod";

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

export const goToPlayerSchema = z.object({
  function: z.literal("goToPlayer"),
  arguments: z.object({
    playerName: z.string(),
    distance: z.number().nonnegative().optional(),
  }),
});

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

export const goToPositionSchema = z.object({
  function: z.literal("goToPosition"),
  arguments: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
});

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

export const followPlayerSchema = z.object({
  function: z.literal("followPlayer"),
  arguments: z.object({
    playerName: z.string(),
    distance: z.number().nonnegative().optional(),
  }),
});

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

export const moveAwaySchema = z.object({
  function: z.literal("moveAway"),
  arguments: z.object({
    distance: z.number().min(1),
  }),
});
