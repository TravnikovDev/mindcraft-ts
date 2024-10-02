// src/agent/modes.ts

import * as world from "./library/world";
import * as mc from "../utils/mcdata";
import settings from "../../settings";
import { skills } from "./library";
import { Agent } from "./agent"; // Assuming Agent interface or class is defined
import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";

function say(agent: Agent, message: string): void {
  agent.bot.modes.behavior_log += message + "\n";
  if (agent.shut_up || !settings.narrate_behavior) return;
  agent.bot.chat(message);
}

// Define the Mode interface
interface Mode {
  name: string;
  description: string;
  interrupts: string[];
  on: boolean;
  active: boolean;
  paused?: boolean;
  update: (agent: Agent) => Promise<void> | void;
  [key: string]: any; // For additional properties
}

// Define the modes array
const modes: Mode[] = [
  {
    name: "self_preservation",
    description:
      "Respond to drowning, burning, and damage at low health. Interrupts all actions.",
    interrupts: ["all"],
    on: true,
    active: false,
    fall_blocks: ["sand", "gravel", "concrete_powder"], // includes matching substrings like 'sandstone' and 'red_sand'
    update: async function (agent: Agent) {
      const bot = agent.bot;
      let block = bot.blockAt(bot.entity.position);
      let blockAbove = bot.blockAt(bot.entity.position.offset(0, 1, 0));
      if (!block) block = { name: "air" } as any; // hacky fix when blocks are not loaded
      if (!blockAbove) blockAbove = { name: "air" } as any;
      if (
        blockAbove &&
        (blockAbove.name === "water" || blockAbove.name === "flowing_water")
      ) {
        // does not call execute so does not interrupt other actions
        if (!bot.pathfinder.goal) {
          bot.setControlState("jump", true);
        }
      } else if (
        blockAbove &&
        this.fall_blocks.some((name: string) => blockAbove.name.includes(name))
      ) {
        execute(this, agent, async () => {
          await skills.moveAway(bot, 2);
        });
      } else if (
        block?.name === "lava" ||
        block?.name === "flowing_lava" ||
        block?.name === "fire" ||
        blockAbove?.name === "lava" ||
        blockAbove?.name === "flowing_lava" ||
        blockAbove?.name === "fire"
      ) {
        say(agent, "I'm on fire!"); // TODO: gets stuck in lava
        execute(this, agent, async () => {
          const nearestWater = world.getNearestBlock(bot, "water", 20);
          if (nearestWater) {
            const pos = nearestWater.position;
            await skills.goToPosition(bot, pos.x, pos.y, pos.z, 0.2);
            say(agent, "Ahhhh that's better!");
          } else {
            await skills.moveAway(bot, 5);
          }
        });
      } else if (
        Date.now() - (bot.lastDamageTime ?? 0) < 3000 &&
        (bot.health < 5 || (bot.lastDamageTaken ?? 0) >= bot.health)
      ) {
        say(agent, "I'm dying!");
        execute(this, agent, async () => {
          await skills.moveAway(bot, 20);
        });
      } else if (agent.isIdle()) {
        bot.clearControlStates(); // clear jump if not in danger or doing anything else
      }
    },
  },
  {
    name: "unstuck",
    description:
      "Attempt to get unstuck when in the same place for a while. Interrupts some actions.",
    interrupts: [
      "collectBlocks",
      "goToPlayer",
      "collectAllBlocks",
      "goToPlace",
    ],
    on: true,
    active: false,
    prev_location: null as any,
    distance: 2,
    stuck_time: 0,
    last_time: Date.now(),
    max_stuck_time: 20,
    update: async function (agent: Agent) {
      if (agent.isIdle()) return;
      const bot = agent.bot;
      if (
        this.prev_location &&
        this.prev_location.distanceTo(bot.entity.position) < this.distance
      ) {
        this.stuck_time += (Date.now() - this.last_time) / 1000;
      } else {
        this.prev_location = bot.entity.position.clone();
        this.stuck_time = 0;
      }
      if (this.stuck_time > this.max_stuck_time) {
        say(agent, "I'm stuck!");
        execute(this, agent, async () => {
          await skills.moveAway(bot, 5);
        });
      }
      this.last_time = Date.now();
    },
  },
  {
    name: "cowardice",
    description: "Run away from enemies. Interrupts all actions.",
    interrupts: ["all"],
    on: true,
    active: false,
    update: async function (agent: Agent) {
      const enemy = world.getNearestEntityWhere(
        agent.bot,
        (entity: Entity) => mc.isHostile(entity),
        16
      );
      if (enemy && (await world.isClearPath(agent.bot, enemy))) {
        say(agent, `Aaa! A ${enemy.name}!`);
        execute(this, agent, async () => {
          await skills.avoidEnemies(agent.bot, 24);
        });
      }
    },
  },
  {
    name: "self_defense",
    description: "Attack nearby enemies. Interrupts all actions.",
    interrupts: ["all"],
    on: true,
    active: false,
    update: async function (agent: Agent) {
      const enemy = world.getNearestEntityWhere(
        agent.bot,
        (entity: Entity) => mc.isHostile(entity),
        8
      );
      if (enemy && (await world.isClearPath(agent.bot, enemy))) {
        say(agent, `Fighting ${enemy.name}!`);
        execute(this, agent, async () => {
          await skills.defendSelf(agent.bot, 8);
        });
      }
    },
  },
  {
    name: "hunting",
    description: "Hunt nearby animals when idle.",
    interrupts: [],
    on: true,
    active: false,
    update: async function (agent: Agent) {
      const huntable = world.getNearestEntityWhere(
        agent.bot,
        (entity: Entity) => mc.isHuntable(entity),
        8
      );
      if (huntable && (await world.isClearPath(agent.bot, huntable))) {
        execute(this, agent, async () => {
          say(agent, `Hunting ${huntable.name}!`);
          await skills.attackEntity(agent.bot, huntable);
        });
      }
    },
  },
  {
    name: "item_collecting",
    description: "Collect nearby items when idle.",
    interrupts: ["followPlayer"],
    on: true,
    active: false,
    wait: 2, // number of seconds to wait after noticing an item to pick it up
    prev_item: null as Entity | null,
    noticed_at: -1,
    update: async function (agent: Agent) {
      const item = world.getNearestEntityWhere(
        agent.bot,
        (entity: Entity) => entity.name === "item",
        8
      );
      const empty_inv_slots = agent.bot.inventory.emptySlotCount();
      if (
        item &&
        item !== this.prev_item &&
        (await world.isClearPath(agent.bot, item)) &&
        empty_inv_slots > 1
      ) {
        if (this.noticed_at === -1) {
          this.noticed_at = Date.now();
        }
        if (Date.now() - this.noticed_at > this.wait * 1000) {
          say(agent, `Picking up item!`);
          this.prev_item = item;
          execute(this, agent, async () => {
            await skills.pickupNearbyItems(agent.bot);
          });
          this.noticed_at = -1;
        }
      } else {
        this.noticed_at = -1;
      }
    },
  },
  {
    name: "torch_placing",
    description: "Place torches when idle and there are no torches nearby.",
    interrupts: ["followPlayer"],
    on: true,
    active: false,
    cooldown: 5,
    last_place: Date.now(),
    update: function (agent: Agent) {
      if (world.shouldPlaceTorch(agent.bot)) {
        if (Date.now() - this.last_place < this.cooldown * 1000) return;
        execute(this, agent, async () => {
          const pos = agent.bot.entity.position;
          await skills.placeBlock(
            agent.bot,
            "torch",
            pos.x,
            pos.y,
            pos.z,
            "bottom",
            true
          );
        });
        this.last_place = Date.now();
      }
    },
  },
  {
    name: "idle_staring",
    description: "Animation to look around at entities when idle.",
    interrupts: [],
    on: true,
    active: false,
    staring: false,
    last_entity: null as Entity | null,
    next_change: 0,
    update: function (agent: Agent) {
      const entity = agent.bot.nearestEntity();
      let entity_in_view =
        entity &&
        entity.position.distanceTo(agent.bot.entity.position) < 10 &&
        entity.name !== "enderman";
      if (entity_in_view && entity !== this.last_entity) {
        this.staring = true;
        this.last_entity = entity;
        this.next_change = Date.now() + Math.random() * 1000 + 4000;
      }
      if (entity_in_view && this.staring) {
        let isbaby = entity?.type !== "player" && entity?.metadata[16];
        let height = isbaby ? entity!.height / 2 : entity!.height;
        if (entity) {
          agent.bot.lookAt(entity.position.offset(0, height, 0));
        }
      }
      if (!entity_in_view) this.last_entity = null;
      if (Date.now() > this.next_change) {
        // look in random direction
        this.staring = Math.random() < 0.3;
        if (!this.staring) {
          const yaw = Math.random() * Math.PI * 2;
          const pitch = (Math.random() * Math.PI) / 2 - Math.PI / 4;
          agent.bot.look(yaw, pitch, false);
        }
        this.next_change = Date.now() + Math.random() * 10000 + 2000;
      }
    },
  },
  {
    name: "cheat",
    description: "Use cheats to instantly place blocks and teleport.",
    interrupts: [],
    on: false,
    active: false,
    update: function (agent: Agent) {
      /* do nothing */
    },
  },
];

// execute function
async function execute(
  mode: Mode,
  agent: Agent,
  func: () => Promise<void>,
  timeout = -1
): Promise<void> {
  if (agent.self_prompter.on) agent.self_prompter.stopLoop();
  mode.active = true;
  let code_return = await agent.coder.execute(async () => {
    await func();
  }, timeout);
  mode.active = false;
  console.log(
    `Mode ${mode.name} finished executing, code_return: ${code_return.message}`
  );
}

class ModeController {
  agent: Agent;
  modes_list: Mode[];
  modes_map: { [name: string]: Mode };
  behavior_log: string;

  constructor(agent: Agent) {
    this.agent = agent;
    this.modes_list = modes;
    this.modes_map = {};
    this.behavior_log = "";
    for (let mode of this.modes_list) {
      this.modes_map[mode.name] = mode;
    }
  }

  exists(mode_name: string): boolean {
    return this.modes_map[mode_name] != null;
  }

  setOn(mode_name: string, on: boolean): void {
    if (this.modes_map[mode_name]) {
      this.modes_map[mode_name].on = on;
    }
  }

  isOn(mode_name: string): boolean {
    return this.modes_map[mode_name]?.on ?? false;
  }

  pause(mode_name: string): void {
    if (this.modes_map[mode_name]) {
      this.modes_map[mode_name].paused = true;
    }
  }

  getMiniDocs(): string {
    // no descriptions
    let res = "Agent Modes:";
    for (let mode of this.modes_list) {
      let on = mode.on ? "ON" : "OFF";
      res += `\n- ${mode.name}(${on})`;
    }
    return res;
  }

  getDocs(): string {
    let res = "Agent Modes:";
    for (let mode of this.modes_list) {
      let on = mode.on ? "ON" : "OFF";
      res += `\n- ${mode.name}(${on}): ${mode.description}`;
    }
    return res;
  }

  unPauseAll(): void {
    for (let mode of this.modes_list) {
      if (mode.paused) console.log(`Unpausing mode ${mode.name}`);
      mode.paused = false;
    }
  }

  async update(): Promise<void> {
    if (this.agent.isIdle()) {
      this.unPauseAll();
    }
    for (let mode of this.modes_list) {
      let interruptible =
        mode.interrupts.some((i: string) => i === "all") ||
        mode.interrupts.some(
          (i: string) => i === this.agent.coder.cur_action_name
        );
      if (
        mode.on &&
        !mode.paused &&
        !mode.active &&
        (this.agent.isIdle() || interruptible)
      ) {
        await mode.update(this.agent);
      }
      if (mode.active) break;
    }
  }

  flushBehaviorLog(): string {
    const log = this.behavior_log;
    this.behavior_log = "";
    return log;
  }

  getJson(): any {
    let res: any = {};
    for (let mode of this.modes_list) {
      res[mode.name] = mode.on;
    }
    return res;
  }

  loadJson(json: any): void {
    for (let mode of this.modes_list) {
      if (json[mode.name] !== undefined) {
        mode.on = json[mode.name];
      }
    }
  }
}

export function initModes(agent: Agent): void {
  // the mode controller is added to the bot object so it is accessible from anywhere the bot is used
  agent.bot.modes = new ModeController(agent);
  let modes = agent.prompter.getInitModes();
  if (modes) {
    agent.bot.modes.loadJson(modes);
  }
}
