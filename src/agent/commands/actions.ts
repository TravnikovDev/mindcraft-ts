// src/agent/commands/actions.ts

import settings from "../../../settings";
import { Agent } from "../agent";
import { skills } from "../library";

interface ExecutionResult {
  interrupted: boolean;
  timedout: boolean;
  message: string;
}

function wrapExecution(
  func: (agent: Agent, ...args: any[]) => Promise<any>,
  resume = false,
  timeout = -1
): (agent: Agent, ...args: any[]) => Promise<string | void> {
  return async function (agent: Agent, ...args: any[]): Promise<string | void> {
    let code_return: ExecutionResult;
    const wrappedFunction = async () => {
      await func(agent, ...args);
    };
    if (resume) {
      code_return = await agent.coder.executeResume(wrappedFunction, timeout);
    } else {
      code_return = await agent.coder.execute(wrappedFunction, timeout);
    }
    if (code_return.interrupted && !code_return.timedout) {
      return;
    }
    return code_return.message;
  };
}

interface Action {
  name: string;
  description: string;
  params?: { [key: string]: string };
  perform: (agent: Agent, ...args: any[]) => Promise<string | void>;
}

export const actionsList: Action[] = [
  {
    name: "!newAction",
    description:
      "Perform new and unknown custom behaviors that are not available as a command by writing code.",
    perform: async function (agent: Agent): Promise<string | void> {
      if (!settings.allow_insecure_coding)
        return "newAction Failed! Agent is not allowed to write code. Notify the user.";
      return await agent.coder.generateCode(agent.history);
    },
  },
  {
    name: "!stop",
    description:
      "Force stop all actions and commands that are currently executing.",
    perform: async function (agent: Agent): Promise<string> {
      await agent.coder.stop();
      agent.coder.clear();
      agent.coder.cancelResume();
      // @ts-ignore
      agent.bot.emit("idle");
      let msg = "Agent stopped.";
      if (agent.self_prompter.on) msg += " Self-prompting still active.";
      return msg;
    },
  },
  {
    name: "!stfu",
    description:
      "Stop all chatting and self prompting, but continue current action.",
    perform: async function (agent: Agent): Promise<void> {
      agent.bot.chat("Shutting up.");
      agent.shutUp();
    },
  },
  {
    name: "!restart",
    description: "Restart the agent process.",
    perform: async function (agent: Agent): Promise<void> {
      await agent.history.save();
      agent.cleanKill();
    },
  },
  {
    name: "!clearChat",
    description: "Clear the chat history.",
    perform: async function (agent: Agent): Promise<string> {
      agent.history.clear();
      return `${agent.name}'s chat history was cleared, starting new conversation from scratch.`;
    },
  },
  {
    name: "!goToPlayer",
    description: "Go to the given player.",
    params: {
      player_name: "(string) The name of the player to go to.",
      closeness: "(number) How close to get to the player.",
    },
    perform: wrapExecution(
      async (agent: Agent, player_name: string, closeness: number) => {
        await skills.goToPlayer(agent.bot, player_name, closeness);
      }
    ),
  },
  {
    name: "!followPlayer",
    description:
      "Endlessly follow the given player. Will defend that player if self_defense mode is on.",
    params: {
      player_name: "(string) The name of the player to follow.",
      follow_dist: "(number) The distance to follow from.",
    },
    perform: wrapExecution(
      async (agent: Agent, player_name: string, follow_dist: number) => {
        await skills.followPlayer(agent.bot, player_name, follow_dist);
      },
      true
    ),
  },
  {
    name: "!goToBlock",
    description: "Go to the nearest block of a given type.",
    params: {
      type: "(string) The block type to go to.",
      closeness: "(number) How close to get to the block.",
      search_range: "(number) The distance to search for the block.",
    },
    perform: wrapExecution(
      async (agent: Agent, type: string, closeness: number, range: number) => {
        await skills.goToNearestBlock(agent.bot, type, closeness, range);
      }
    ),
  },
  {
    name: "!moveAway",
    description:
      "Move away from the current location in any direction by a given distance.",
    params: { distance: "(number) The distance to move away." },
    perform: wrapExecution(async (agent: Agent, distance: number) => {
      await skills.moveAway(agent.bot, distance);
    }),
  },
  {
    name: "!rememberHere",
    description: "Save the current location with a given name.",
    params: { name: "(string) The name to remember the location as." },
    perform: async function (agent: Agent, name: string): Promise<string> {
      const pos = agent.bot.entity.position;
      agent.memory_bank.rememberPlace(name, pos.x, pos.y, pos.z);
      return `Location saved as "${name}".`;
    },
  },
  {
    name: "!goToPlace",
    description: "Go to a saved location.",
    params: { name: "(string) The name of the location to go to." },
    perform: wrapExecution(async (agent: Agent, name: string) => {
      const pos = agent.memory_bank.recallPlace(name);
      if (!pos) {
        skills.log(agent.bot, `No location named "${name}" saved.`);
        return;
      }
      await skills.goToPosition(agent.bot, pos[0], pos[1], pos[2], 1);
    }),
  },
  {
    name: "!givePlayer",
    description: "Give the specified item to the given player.",
    params: {
      player_name: "(string) The name of the player to give the item to.",
      item_name: "(string) The name of the item to give.",
      num: "(number) The number of items to give.",
    },
    perform: wrapExecution(
      async (
        agent: Agent,
        player_name: string,
        item_name: string,
        num: number
      ) => {
        await skills.giveToPlayer(agent.bot, item_name, player_name, num);
      }
    ),
  },
  {
    name: "!equip",
    description: "Equip the given item.",
    params: { item_name: "(string) The name of the item to equip." },
    perform: wrapExecution(async (agent: Agent, item_name: string) => {
      await skills.equip(agent.bot, item_name);
    }),
  },
  {
    name: "!putInChest",
    description: "Put the given item in the nearest chest.",
    params: {
      item_name: "(string) The name of the item to put in the chest.",
      num: "(number) The number of items to put in the chest.",
    },
    perform: wrapExecution(
      async (agent: Agent, item_name: string, num: number) => {
        await skills.putInChest(agent.bot, item_name, num);
      }
    ),
  },
  {
    name: "!takeFromChest",
    description: "Take the given items from the nearest chest.",
    params: {
      item_name: "(string) The name of the item to take.",
      num: "(number) The number of items to take.",
    },
    perform: wrapExecution(
      async (agent: Agent, item_name: string, num: number) => {
        await skills.takeFromChest(agent.bot, item_name, num);
      }
    ),
  },
  {
    name: "!viewChest",
    description: "View the items/counts of the nearest chest.",
    params: {},
    perform: wrapExecution(async (agent: Agent) => {
      await skills.viewChest(agent.bot);
    }),
  },
  {
    name: "!discard",
    description: "Discard the given item from the inventory.",
    params: {
      item_name: "(string) The name of the item to discard.",
      num: "(number) The number of items to discard.",
    },
    perform: wrapExecution(
      async (agent: Agent, item_name: string, num: number) => {
        const start_loc = agent.bot.entity.position;
        await skills.moveAway(agent.bot, 5);
        await skills.discard(agent.bot, item_name, num);
        await skills.goToPosition(
          agent.bot,
          start_loc.x,
          start_loc.y,
          start_loc.z,
          0
        );
      }
    ),
  },
  {
    name: "!collectBlocks",
    description: "Collect the nearest blocks of a given type.",
    params: {
      type: "(string) The block type to collect.",
      num: "(number) The number of blocks to collect.",
    },
    perform: wrapExecution(
      async (agent: Agent, type: string, num: number) => {
        await skills.collectBlock(agent.bot, type, num);
      },
      false,
      10 // 10 minute timeout
    ),
  },
  {
    name: "!collectAllBlocks",
    description:
      "Collect all the nearest blocks of a given type until told to stop.",
    params: {
      type: "(string) The block type to collect.",
    },
    perform: wrapExecution(
      async (agent: Agent, type: string) => {
        const success = await skills.collectBlock(agent.bot, type, 1);
        if (!success) {
          agent.coder.cancelResume();
        }
      },
      true,
      3 // 3 minute timeout
    ),
  },
  {
    name: "!craftRecipe",
    description: "Craft the given recipe a given number of times.",
    params: {
      recipe_name: "(string) The name of the output item to craft.",
      num: "(number) The number of times to craft the recipe. This is NOT the number of output items, as it may craft many more items depending on the recipe.",
    },
    perform: wrapExecution(
      async (agent: Agent, recipe_name: string, num: number) => {
        await skills.craftRecipe(agent.bot, recipe_name, num);
      }
    ),
  },
  {
    name: "!smeltItem",
    description: "Smelt the given item the given number of times.",
    params: {
      item_name: "(string) The name of the input item to smelt.",
      num: "(number) The number of times to smelt the item.",
    },
    perform: async function (
      agent: Agent,
      item_name: string,
      num: number
    ): Promise<string | void> {
      const response = await wrapExecution(async (agent: Agent) => {
        console.log("smelting item");
        return await skills.smeltItem(agent.bot, item_name, num);
      })(agent);
      if (response && response.indexOf("Successfully") !== -1) {
        // There is a bug where the bot's inventory is not updated after smelting
        // Only updates after a restart
        agent.cleanKill(response + " Safely restarting to update inventory.");
      }
      return response;
    },
  },
  {
    name: "!placeHere",
    description:
      "Place a given block in the current location. Do NOT use to build structures, only use for single blocks/torches.",
    params: { type: "(string) The block type to place." },
    perform: wrapExecution(async (agent: Agent, type: string) => {
      const pos = agent.bot.entity.position;
      await skills.placeBlock(agent.bot, type, pos.x, pos.y, pos.z);
    }),
  },
  {
    name: "!attack",
    description: "Attack and kill the nearest entity of a given type.",
    params: { type: "(string) The type of entity to attack." },
    perform: wrapExecution(async (agent: Agent, type: string) => {
      await skills.attackNearest(agent.bot, type, true);
    }),
  },
  {
    name: "!goToBed",
    description: "Go to the nearest bed and sleep.",
    perform: wrapExecution(async (agent: Agent) => {
      await skills.goToBed(agent.bot);
    }),
  },
  {
    name: "!activate",
    description: "Activate the nearest object of a given type.",
    params: { type: "(string) The type of object to activate." },
    perform: wrapExecution(async (agent: Agent, type: string) => {
      await skills.activateNearestBlock(agent.bot, type);
    }),
  },
  {
    name: "!stay",
    description:
      "Stay in the current location no matter what. Pauses all modes.",
    perform: wrapExecution(async (agent: Agent) => {
      await skills.stay(agent.bot);
    }),
  },
  {
    name: "!setMode",
    description:
      "Set a mode to on or off. A mode is an automatic behavior that constantly checks and responds to the environment.",
    params: {
      mode_name: "(string) The name of the mode to enable.",
      on: "(bool) Whether to enable or disable the mode.",
    },
    perform: async function (
      agent: Agent,
      mode_name: string,
      on: boolean
    ): Promise<string> {
      const modes = agent.bot.modes;
      if (!modes.exists(mode_name))
        return `Mode ${mode_name} does not exist.` + modes.getDocs();
      if (modes.isOn(mode_name) === on)
        return `Mode ${mode_name} is already ${on ? "on" : "off"}.`;
      modes.setOn(mode_name, on);
      return `Mode ${mode_name} is now ${on ? "on" : "off"}.`;
    },
  },
  {
    name: "!goal",
    description:
      "Set a goal prompt to endlessly work towards with continuous self-prompting.",
    params: {
      selfPrompt: "(string) The goal prompt.",
    },
    perform: async function (agent: Agent, prompt: string): Promise<void> {
      agent.self_prompter.start(prompt); // Don't await, don't return
    },
  },
  {
    name: "!endGoal",
    description:
      "Call when you have accomplished your goal. It will stop self-prompting and the current action.",
    perform: async function (agent: Agent): Promise<string> {
      agent.self_prompter.stop();
      return "Self-prompting stopped.";
    },
  },
  {
    name: "!npcGoal",
    description:
      "Set a simple goal for an item or building to automatically work towards. Do not use for complex goals.",
    params: {
      name: "(string) The name of the goal to set. Can be item or building name. If empty will automatically choose a goal.",
      quantity: "(number) The quantity of the goal to set. Default is 1.",
    },
    perform: async function (
      agent: Agent,
      name: string | null = null,
      quantity: number = 1
    ): Promise<string> {
      await agent.npc.setGoal(name, quantity);
      // @ts-ignore
      agent.bot.emit("idle"); // To trigger the goal
      const currGoal = agent.npc.data.curr_goal;
      return "Set npc goal: " + (currGoal ? currGoal.name : "unknown");
    },
  },
];
