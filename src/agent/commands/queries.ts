// src/agent/commands/queries.ts

import * as world from "../library/world";
import * as mc from "../../utils/mcdata";
import { Agent } from "../agent"; // Assuming Agent interface is defined

interface Query {
  name: string;
  description: string;
  perform: (agent: Agent) => string | Promise<string>;
}

const pad = (str: string): string => {
  return "\n" + str + "\n";
};

// Queries are commands that just return strings and don't affect anything in the world
export const queryList: Query[] = [
  {
    name: "!stats",
    description: "Get your bot's location, health, hunger, and time of day.",
    perform: function (agent: Agent): string {
      const bot = agent.bot;
      let res = "STATS";
      const pos = bot.entity.position;
      // Display position to 2 decimal places
      res += `\n- Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
      res += `\n- Gamemode: ${bot.game.gameMode}`;
      res += `\n- Health: ${Math.round(bot.health)} / 20`;
      res += `\n- Hunger: ${Math.round(bot.food)} / 20`;
      res += `\n- Biome: ${world.getBiomeName(bot)}`;
      let weather = "Clear";
      if (bot.rainState > 0) weather = "Rain";
      if (bot.thunderState > 0) weather = "Thunderstorm";
      res += `\n- Weather: ${weather}`;

      // Light properties can be inaccurate, so we may omit them

      if (bot.time.timeOfDay < 6000) {
        res += "\n- Time: Morning";
      } else if (bot.time.timeOfDay < 12000) {
        res += "\n- Time: Afternoon";
      } else {
        res += "\n- Time: Night";
      }

      const other_players = world.getNearbyPlayerNames(bot);
      if (other_players.length > 0) {
        res += "\n- Other Players: " + other_players.join(", ");
      }

      res += "\n" + agent.bot.modes.getMiniDocs() + "\n";
      return pad(res);
    },
  },
  {
    name: "!inventory",
    description: "Get your bot's inventory.",
    perform: function (agent: Agent): string {
      const bot = agent.bot;
      const inventory = world.getInventoryCounts(bot);
      let res = "INVENTORY";
      for (const item in inventory) {
        if (inventory[item] && inventory[item] > 0)
          res += `\n- ${item}: ${inventory[item]}`;
      }
      if (res === "INVENTORY") {
        res += ": none";
      } else if (bot.game.gameMode === "creative") {
        res +=
          "\n(You have infinite items in creative mode. You do not need to gather resources!!)";
      }
      return pad(res);
    },
  },
  {
    name: "!nearbyBlocks",
    description: "Get the blocks near the bot.",
    perform: function (agent: Agent): string {
      const bot = agent.bot;
      let res = "NEARBY_BLOCKS";
      const blocks = world.getNearbyBlockTypes(bot);
      for (const block of blocks) {
        res += `\n- ${block}`;
      }
      if (blocks.length === 0) {
        res += ": none";
      }
      return pad(res);
    },
  },
  {
    name: "!craftable",
    description: "Get the craftable items with the bot's inventory.",
    perform: function (agent: Agent): string {
      const bot = agent.bot;
      const table = world.getNearestBlock(bot, "crafting_table");
      let res = "CRAFTABLE_ITEMS";
      for (const item of mc.getAllItems()) {
        const recipes = bot.recipesFor(item.id, null, 1, table);
        if (recipes.length > 0) {
          res += `\n- ${item.name}`;
        }
      }
      if (res === "CRAFTABLE_ITEMS") {
        res += ": none";
      }
      return pad(res);
    },
  },
  {
    name: "!entities",
    description: "Get the nearby players and entities.",
    perform: function (agent: Agent): string {
      const bot = agent.bot;
      let res = "NEARBY_ENTITIES";
      const playerNames = world.getNearbyPlayerNames(bot);
      const entityTypes = world.getNearbyEntityTypes(bot);
      for (const player of playerNames) {
        res += `\n- player: ${player}`;
      }
      for (const entity of entityTypes) {
        res += `\n- mob: ${entity}`;
      }
      if (res === "NEARBY_ENTITIES") {
        res += ": none";
      }
      return pad(res);
    },
  },
  {
    name: "!modes",
    description:
      "Get all available modes and their docs and see which are on/off.",
    perform: function (agent: Agent): string {
      return agent.bot.modes.getDocs();
    },
  },
  {
    name: "!savedPlaces",
    description: "List all saved locations.",
    perform: function (agent: Agent): string {
      const placeNames = agent.memory_bank.getKeys();
      return "Saved place names: " + placeNames.join(", ");
    },
  },
];
