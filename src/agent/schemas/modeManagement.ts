import { z } from "zod";

export const setModeFunctionSchema = {
  name: "setMode",
  description: "Enable or disable a specific mode.",
  parameters: {
    type: "object",
    properties: {
      modeName: {
        type: "string",
        description: "Name of the mode to set.",
      },
      enabled: {
        type: "boolean",
        description: "Whether to enable (true) or disable (false) the mode.",
      },
    },
    required: ["modeName", "enabled"],
  },
};

export const setModeSchema = z.object({
  function: z.literal("setMode"),
  arguments: z.object({
    modeName: z.string(),
    enabled: z.boolean(),
  }),
});
