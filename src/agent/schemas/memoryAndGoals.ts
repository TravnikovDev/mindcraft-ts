import { z } from "zod";

export const rememberHereFunctionSchema = {
  name: "rememberHere",
  description: "Remember the current location with a label.",
  parameters: {
    type: "object",
    properties: {
      label: { type: "string", description: "Label for the location." },
    },
    required: ["label"],
  },
};

export const rememberHereSchema = z.object({
  function: z.literal("rememberHere"),
  arguments: z.object({
    label: z.string(),
  }),
});

export const goToPlaceFunctionSchema = {
  name: "goToPlace",
  description: "Go to a remembered location.",
  parameters: {
    type: "object",
    properties: {
      label: {
        type: "string",
        description: "Label of the remembered location.",
      },
    },
    required: ["label"],
  },
};

export const goToPlaceSchema = z.object({
  function: z.literal("goToPlace"),
  arguments: z.object({
    label: z.string(),
  }),
});

export const setGoalFunctionSchema = {
  name: "setGoal",
  description: "Set a long-term goal.",
  parameters: {
    type: "object",
    properties: {
      goalDescription: {
        type: "string",
        description: "Description of the goal.",
      },
    },
    required: ["goalDescription"],
  },
};

export const setGoalSchema = z.object({
  function: z.literal("setGoal"),
  arguments: z.object({
    goalDescription: z.string(),
  }),
});

export const endGoalFunctionSchema = {
  name: "endGoal",
  description: "End the current goal.",
  parameters: {
    type: "object",
    properties: {},
  },
};

export const endGoalSchema = z.object({
  function: z.literal("endGoal"),
  arguments: z.object({}),
});
