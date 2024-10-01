// src/agent/npc/build_goal.ts

import { Vec3 } from "vec3";
import * as world from "../library/world";
import * as mc from "../../utils/mcdata";
import { blockSatisfied, getTypeOfGeneric, rotateXZ } from "./utils";
import { Agent } from "../agent"; // Assuming Agent interface is defined
import { skills } from "../library";

export class BuildGoal {
  agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async wrapSkill(func: () => Promise<void>): Promise<boolean> {
    if (!this.agent.isIdle()) return false;
    const res = await this.agent.coder.execute(func);
    return !res.interrupted;
  }

  async executeNext(
    goal: any,
    position: Vec3 | null = null,
    orientation: number | null = null
  ): Promise<{
    missing: { [blockType: string]: number };
    acted: boolean;
    position: Vec3 | null;
    orientation: number | null;
  }> {
    const sizex = goal.blocks[0][0].length;
    const sizez = goal.blocks[0].length;
    const sizey = goal.blocks.length;
    if (!position) {
      for (let x = 0; x < sizex - 1; x++) {
        position = world.getNearestFreeSpace(this.agent.bot, sizex - x, 16);
        if (position) break;
      }
    }
    if (orientation === null) {
      orientation = Math.floor(Math.random() * 4);
    }

    const inventory = world.getInventoryCounts(this.agent.bot);
    const missing: { [blockType: string]: number } = {};
    let acted = false;

    for (let y = goal.offset; y < sizey + goal.offset; y++) {
      for (let z = 0; z < sizez; z++) {
        for (let x = 0; x < sizex; x++) {
          const [rx, rz] = rotateXZ(x, z, orientation, sizex, sizez);
          const ry = y - goal.offset;
          const block_name = goal.blocks[ry][rz][rx];
          if (block_name === null || block_name === "") continue;

          const world_pos = new Vec3(
            position.x + x,
            position.y + y,
            position.z + z
          );
          const current_block = this.agent.bot.blockAt(world_pos);

          let res: boolean | null = null;
          if (
            current_block !== null &&
            !blockSatisfied(block_name, current_block)
          ) {
            acted = true;

            if (current_block.name !== "air") {
              res = await this.wrapSkill(async () => {
                await skills.breakBlockAt(
                  this.agent.bot,
                  world_pos.x,
                  world_pos.y,
                  world_pos.z
                );
              });
              if (!res)
                return {
                  missing: missing,
                  acted: acted,
                  position: position,
                  orientation: orientation,
                };
            }

            if (block_name !== "air") {
              const block_typed = getTypeOfGeneric(this.agent.bot, block_name);
              if (inventory[block_typed] > 0) {
                res = await this.wrapSkill(async () => {
                  await skills.placeBlock(
                    this.agent.bot,
                    block_typed,
                    world_pos.x,
                    world_pos.y,
                    world_pos.z
                  );
                });
                if (!res)
                  return {
                    missing: missing,
                    acted: acted,
                    position: position,
                    orientation: orientation,
                  };
              } else {
                if (missing[block_typed] === undefined)
                  missing[block_typed] = 0;
                missing[block_typed]++;
              }
            }
          }
        }
      }
    }
    return {
      missing: missing,
      acted: acted,
      position: position,
      orientation: orientation,
    };
  }
}
