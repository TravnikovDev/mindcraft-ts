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

export const endGoalFunctionSchema = {
  name: "endGoal",
  description: "End the current goal.",
  parameters: {
    type: "object",
    properties: {},
  },
};
