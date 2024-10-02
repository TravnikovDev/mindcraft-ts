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
