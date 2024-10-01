// src/agent/npc/controller.ts

import { readdirSync, readFileSync } from "fs";
import { NPCData } from "./data";
import { ItemGoal } from "./item_goal";
import { BuildGoal } from "./build_goal";
import { itemSatisfied, rotateXZ } from "./utils";
import * as world from "../library/world";
import * as mc from "../../utils/mcdata";
import { Agent } from "../agent"; // Assuming Agent interface is defined
import { Vec3 } from "vec3";
import { skills } from "../library";

interface Goal {
  name: string;
  quantity: number;
}

interface Construction {
  blocks: string[][][];
  offset: number;
}

interface ExecutionResult {
  interrupted: boolean;
}

export class NPCController {
  agent: Agent;
  data: NPCData;
  temp_goals: Goal[];
  item_goal: ItemGoal;
  build_goal: BuildGoal;
  constructions: { [name: string]: Construction };
  last_goals: { [name: string]: boolean | Goal };

  constructor(agent: Agent) {
    this.agent = agent;
    this.data = NPCData.fromObject(agent.prompter.profile.npc);
    this.temp_goals = [];
    this.item_goal = new ItemGoal(agent, this.data);
    this.build_goal = new BuildGoal(agent);
    this.constructions = {};
    this.last_goals = {};
  }

  getBuiltPositions(): { x: number; y: number; z: number }[] {
    const positions: { x: number; y: number; z: number }[] = [];
    for (const name in this.data.built) {
      const building = this.data.built[name];
      const position = building.position as Vec3;
      const construction = this.constructions[name];
      const offset = construction.offset;
      const sizex = construction.blocks[0][0].length;
      const sizez = construction.blocks[0].length;
      const sizey = construction.blocks.length;
      for (let y = offset; y < sizey + offset; y++) {
        for (let z = 0; z < sizez; z++) {
          for (let x = 0; x < sizex; x++) {
            positions.push({
              x: position.x + x,
              y: position.y + y,
              z: position.z + z,
            });
          }
        }
      }
    }
    return positions;
  }

  init(): void {
    for (const file of readdirSync("src/agent/npc/construction")) {
      if (file.endsWith(".json")) {
        try {
          const constructionName = file.slice(0, -5);
          const constructionData = JSON.parse(
            readFileSync("src/agent/npc/construction/" + file, "utf8")
          ) as Construction;
          this.constructions[constructionName] = constructionData;
        } catch (e) {
          console.log("Error reading construction file: ", file);
        }
      }
    }

    for (const name in this.constructions) {
      const construction = this.constructions[name];
      let sizez = construction.blocks[0].length;
      let sizex = construction.blocks[0][0].length;
      const max_size = Math.max(sizex, sizez);
      for (let y = 0; y < construction.blocks.length; y++) {
        for (let z = 0; z < max_size; z++) {
          if (z >= construction.blocks[y].length) {
            construction.blocks[y].push([]);
          }
          for (let x = 0; x < max_size; x++) {
            if (x >= construction.blocks[y][z].length) {
              construction.blocks[y][z].push("");
            }
          }
        }
      }
    }

    this.agent.bot.on("idle", async () => {
      if (this.data.goals.length === 0 && !this.data.curr_goal) return;
      // Wait a while for inputs before acting independently
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (!this.agent.isIdle()) return;

      // Pursue goal
      if (!this.agent.coder.resume_func) {
        await this.executeNext();
        this.agent.history.save();
      }
    });
  }

  async setGoal(
    name: string | null = null,
    quantity: number = 1
  ): Promise<void> {
    this.data.curr_goal = null;
    this.last_goals = {};
    if (name) {
      this.data.curr_goal = { name, quantity };
      return;
    }

    if (!this.data.do_set_goal) return;

    const past_goals: { [key: string]: boolean } = {};
    for (const key in this.last_goals) {
      if (typeof this.last_goals[key] === "boolean") {
        past_goals[key] = this.last_goals[key] as boolean;
      }
    }
    for (const goal of this.data.goals) {
      if (past_goals[goal.name] === undefined) past_goals[goal.name] = true;
    }
    const res = await this.agent.prompter.promptGoalSetting(
      this.agent.history.getHistory(),
      past_goals
    );
    if (res) {
      this.data.curr_goal = res;
      console.log("Set new goal: ", res.name, " x", res.quantity);
    } else {
      console.log("Error setting new goal.");
    }
  }

  async executeNext(): Promise<void> {
    if (!this.agent.isIdle()) return;
    await this.agent.coder.execute(async () => {
      await skills.moveAway(this.agent.bot, 2);
    });

    if (!this.data.do_routine || this.agent.bot.time.timeOfDay < 13000) {
      // Exit any buildings
      const building = this.currentBuilding();
      if (building === this.data.home) {
        const door_pos = this.getBuildingDoor(building);
        if (door_pos) {
          await this.agent.coder.execute(async () => {
            await skills.useDoor(this.agent.bot, door_pos);
            await skills.moveAway(this.agent.bot, 2);
          });
        }
      }

      // Work towards goals
      await this.executeGoal();
    } else {
      // Reset goal at the end of the day
      this.data.curr_goal = null;

      // Return to home
      const building = this.currentBuilding();
      if (
        this.data.home !== null &&
        (building === null || building !== this.data.home)
      ) {
        const door_pos = this.getBuildingDoor(this.data.home);
        await this.agent.coder.execute(async () => {
          await skills.useDoor(this.agent.bot, door_pos);
        });
      }

      // Go to bed
      await this.agent.coder.execute(async () => {
        await skills.goToBed(this.agent.bot);
      });
    }

    if (this.agent.isIdle()) this.agent.bot.emit("idle");
  }

  async executeGoal(): Promise<void> {
    // If we need more blocks to complete a building, get those first
    let goals: Goal[] = this.temp_goals.concat(this.data.goals);
    if (this.data.curr_goal) goals = goals.concat([this.data.curr_goal]);
    this.temp_goals = [];

    let acted = false;
    for (const goal of goals) {
      // Obtain goal item or block
      if (this.constructions[goal.name] === undefined) {
        if (!itemSatisfied(this.agent.bot, goal.name, goal.quantity)) {
          const res = await this.item_goal.executeNext(
            goal.name,
            goal.quantity
          );
          this.last_goals[goal.name] = res;
          acted = true;
          break;
        }
      }

      // Build construction goal
      else {
        let res: any = null;
        if (this.data.built.hasOwnProperty(goal.name)) {
          res = await this.build_goal.executeNext(
            this.constructions[goal.name],
            this.data.built[goal.name].position,
            this.data.built[goal.name].orientation
          );
        } else {
          res = await this.build_goal.executeNext(
            this.constructions[goal.name]
          );
          this.data.built[goal.name] = {
            name: goal.name,
            position: res.position,
            orientation: res.orientation,
          };
        }
        if (Object.keys(res.missing).length === 0) {
          this.data.home = goal.name;
        }
        for (const block_name in res.missing) {
          this.temp_goals.push({
            name: block_name,
            quantity: res.missing[block_name],
          });
        }
        if (res.acted) {
          acted = true;
          this.last_goals[goal.name] = Object.keys(res.missing).length === 0;
          break;
        }
      }
    }

    if (!acted && this.data.do_set_goal) await this.setGoal();
  }

  currentBuilding(): string | null {
    const bot_pos = this.agent.bot.entity.position;
    for (const name in this.data.built) {
      const building = this.data.built[name];
      let pos = building.position as Vec3;
      const construction = this.constructions[name];
      let offset = construction.offset;
      let sizex = construction.blocks[0][0].length;
      let sizez = construction.blocks[0].length;
      const sizey = construction.blocks.length;
      if (building.orientation % 2 === 1) [sizex, sizez] = [sizez, sizex];
      if (
        bot_pos.x >= pos.x &&
        bot_pos.x < pos.x + sizex &&
        bot_pos.y >= pos.y + offset &&
        bot_pos.y < pos.y + sizey + offset &&
        bot_pos.z >= pos.z &&
        bot_pos.z < pos.z + sizez
      ) {
        return name;
      }
    }
    return null;
  }

  getBuildingDoor(name: string | null): Vec3 | null {
    if (name === null || this.data.built[name] === undefined) return null;
    let door_x: number | null = null;
    let door_z: number | null = null;
    let door_y: number | null = null;
    const construction = this.constructions[name];
    for (let y = 0; y < construction.blocks.length; y++) {
      for (let z = 0; z < construction.blocks[y].length; z++) {
        for (let x = 0; x < construction.blocks[y][z].length; x++) {
          const block = construction.blocks[y][z][x];
          if (block !== null && block.includes("door")) {
            door_x = x;
            door_z = z;
            door_y = y;
            break;
          }
        }
        if (door_x !== null) break;
      }
      if (door_x !== null) break;
    }
    if (door_x === null || door_z === null || door_y === null) return null;

    let sizex = construction.blocks[0][0].length;
    let sizez = construction.blocks[0].length;
    let orientation = 4 - this.data.built[name].orientation; // this conversion is opposite
    if (orientation === 4) orientation = 0;
    [door_x, door_z] = rotateXZ(door_x, door_z, orientation, sizex, sizez);
    door_y += construction.offset;

    const buildingPosition = this.data.built[name].position as Vec3;

    return new Vec3(
      buildingPosition.x + door_x,
      buildingPosition.y + door_y,
      buildingPosition.z + door_z
    );
  }
}
