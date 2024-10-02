import { z } from "zod";

export const collectBlocksFunctionSchema = {
  name: "collectBlocks",
  description: "Collect a specific quantity of a block type.",
  parameters: {
    type: "object",
    properties: {
      blockType: { type: "string", description: "Type of block to collect." },
      quantity: {
        type: "integer",
        description: "Number of blocks to collect.",
        minimum: 1,
      },
    },
    required: ["blockType", "quantity"],
  },
};

export const collectBlocksSchema = z.object({
  function: z.literal("collectBlocks"),
  arguments: z.object({
    blockType: z.string(),
    quantity: z.number().int().min(1),
  }),
});

export const collectBlockFunctionSchema = {
  name: "collectBlock",
  description: "Collect a block of a specific type.",
  parameters: {
    type: "object",
    properties: {
      blockType: { type: "string", description: "Type of block to collect." },
    },
    required: ["blockType"],
  },
};

export const collectBlockSchema = z.object({
  function: z.literal("collectBlock"),
  arguments: z.object({
    blockType: z.string(),
  }),
});

export const pickupNearbyItemsFunctionSchema = {
  name: "pickupNearbyItems",
  description: "Pick up nearby items.",
  parameters: {
    type: "object",
    properties: {},
  },
};

export const pickupNearbyItemsSchema = z.object({
  function: z.literal("pickupNearbyItems"),
  arguments: z.object({}),
});

export const craftItemFunctionSchema = {
  name: "craftItem",
  description: "Craft a specified item.",
  parameters: {
    type: "object",
    properties: {
      itemName: { type: "string", description: "Name of the item to craft." },
      quantity: {
        type: "integer",
        description: "Number of items to craft (optional).",
        minimum: 1,
        default: 1,
      },
    },
    required: ["itemName"],
  },
};

export const craftItemSchema = z.object({
  function: z.literal("craftItem"),
  arguments: z.object({
    itemName: z.string(),
    quantity: z.number().int().min(1).default(1),
  }),
});

export const smeltItemFunctionSchema = {
  name: "smeltItem",
  description: "Smelt a specified item.",
  parameters: {
    type: "object",
    properties: {
      itemName: { type: "string", description: "Name of the item to smelt." },
      quantity: {
        type: "integer",
        description: "Number of items to smelt (optional).",
        minimum: 1,
        default: 1,
      },
    },
    required: ["itemName"],
  },
};

export const smeltItemSchema = z.object({
  function: z.literal("smeltItem"),
  arguments: z.object({
    itemName: z.string(),
    quantity: z.number().int().min(1).default(1),
  }),
});
