import { z } from "zod";

export const attackEntityFunctionSchema = {
  name: "attackEntity",
  description: "Attack a specific entity.",
  parameters: {
    type: "object",
    properties: {
      entityType: { type: "string", description: "Type of entity to attack." },
    },
    required: ["entityType"],
  },
};

export const attackEntitySchema = z.object({
  function: z.literal("attackEntity"),
  arguments: z.object({
    entityType: z.string(),
  }),
});

export const defendSelfFunctionSchema = {
  name: "defendSelf",
  description: "Defend against nearby threats.",
  parameters: {
    type: "object",
    properties: {},
  },
};

export const defendSelfSchema = z.object({
  function: z.literal("defendSelf"),
  arguments: z.object({}),
});

export const huntEntityFunctionSchema = {
  name: "huntEntity",
  description: "Hunt a specific type of entity.",
  parameters: {
    type: "object",
    properties: {
      entityType: { type: "string", description: "Type of entity to hunt." },
      quantity: {
        type: "integer",
        description: "Number of entities to hunt (optional).",
        minimum: 1,
      },
    },
    required: ["entityType"],
  },
};

export const huntEntitySchema = z.object({
  function: z.literal("huntEntity"),
  arguments: z.object({
    entityType: z.string(),
    quantity: z.number().int().min(1).optional(),
  }),
});
