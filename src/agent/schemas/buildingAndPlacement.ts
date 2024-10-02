export const placeBlockFunctionSchema = {
  name: "placeBlock",
  description: "Place a block at a specified location.",
  parameters: {
    type: "object",
    properties: {
      blockType: { type: "string", description: "Type of block to place." },
      x: { type: "number", description: "X coordinate." },
      y: { type: "number", description: "Y coordinate." },
      z: { type: "number", description: "Z coordinate." },
      face: {
        type: "string",
        description: "Face of the block to place on (optional).",
        enum: ["top", "bottom", "north", "south", "east", "west"],
      },
    },
    required: ["blockType", "x", "y", "z"],
  },
};

export const buildStructureFunctionSchema = {
  name: "buildStructure",
  description: "Build a predefined structure at the current location.",
  parameters: {
    type: "object",
    properties: {
      structureType: {
        type: "string",
        description: "Type of structure to build (e.g., 'house', 'tower').",
      },
      material: {
        type: "string",
        description: "Material to use for building (optional).",
      },
    },
    required: ["structureType"],
  },
};
