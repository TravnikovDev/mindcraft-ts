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

export const pickupNearbyItemsFunctionSchema = {
  name: "pickupNearbyItems",
  description: "Pick up nearby items.",
  parameters: {
    type: "object",
    properties: {},
  },
};

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
