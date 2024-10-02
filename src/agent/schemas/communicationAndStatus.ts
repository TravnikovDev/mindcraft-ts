import { z } from "zod";

export const chatFunctionSchema = {
  name: "chat",
  description: "Send a chat message.",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "Message to send in chat." },
    },
    required: ["message"],
  },
};

export const chatSchema = z.object({
  function: z.literal("chat"),
  arguments: z.object({
    message: z.string(),
  }),
});

export const nearbyBlocksFunctionSchema = {
  name: "nearbyBlocks",
  description: "List nearby block types.",
  parameters: {
    type: "object",
    properties: {
      radius: {
        type: "number",
        description: "Radius to search for blocks (optional).",
        minimum: 1,
        default: 10,
      },
    },
  },
};

export const nearbyBlocksSchema = z.object({
  function: z.literal("nearbyBlocks"),
  arguments: z.object({
    radius: z.number().min(1).default(10).optional(),
  }),
});

export const nearbyEntitiesFunctionSchema = {
  name: "nearbyEntities",
  description: "List nearby entities.",
  parameters: {
    type: "object",
    properties: {
      radius: {
        type: "number",
        description: "Radius to search for entities (optional).",
        minimum: 1,
        default: 10,
      },
    },
  },
};

export const nearbyEntitiesSchema = z.object({
  function: z.literal("nearbyEntities"),
  arguments: z.object({
    radius: z.number().min(1).default(10).optional(),
  }),
});
