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

export const defendSelfFunctionSchema = {
  name: "defendSelf",
  description: "Defend against nearby threats.",
  parameters: {
    type: "object",
    properties: {},
  },
};

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
