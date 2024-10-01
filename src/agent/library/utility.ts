// src/agent/library/skills/utility.ts

import * as world from "./world.js";
import { Bot } from "mineflayer";
import { placeBlock } from "./worldInteraction.js";

export function log(bot: Bot, message: string, chat = false): void {
  (bot as any).output += message + "\n";
  if (chat) {
    bot.chat(message);
  }
}

export async function autoLight(bot: Bot): Promise<boolean> {
  if (world.shouldPlaceTorch(bot)) {
    try {
      const pos = world.getPosition(bot);
      return await placeBlock(
        bot,
        "torch",
        pos.x,
        pos.y,
        pos.z,
        "bottom",
        true
      );
    } catch (err) {
      return false;
    }
  }
  return false;
}
