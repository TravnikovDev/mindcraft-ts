import { Bot } from "mineflayer";

export interface ExtendedBot extends Bot {
  modes: any; // Replace 'any' with the actual type if available
  interrupt_code?: boolean;
  tool: any; // If you have a tool plugin
  collectBlock: any; // If you have a collectBlock plugin
}
