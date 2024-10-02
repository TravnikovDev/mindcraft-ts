import { Bot } from "mineflayer";

export interface ExtendedBot extends Bot {
  modes: any; // Replace 'any' with the actual type if available
  interrupt_code?: boolean;
  tool: any; // If you have a tool plugin
  collectBlock: any; // If you have a collectBlock plugin
  output?: string; // If you have an output plugin
  lastDamageTaken?: number;
  lastDamageTime?: number;
  emit: (event: string, ...args: any[]) => boolean;
}
