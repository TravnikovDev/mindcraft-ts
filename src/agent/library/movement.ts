// src/agent/library/skills/movement.ts

import { Bot } from "mineflayer";
import pf from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import { log } from "./utility";
import * as world from "./world.js";
import { ExtendedBot } from "../../types";

export async function goToPosition(
  bot: ExtendedBot,
  x: number,
  y: number,
  z: number,
  minDistance = 2
): Promise<boolean> {
  if (x == null || y == null || z == null) {
    log(bot, `Missing coordinates, given x:${x} y:${y} z:${z}`);
    return false;
  }
  if (bot.modes.isOn("cheat")) {
    bot.chat(`/tp @s ${x} ${y} ${z}`);
    log(bot, `Teleported to ${x}, ${y}, ${z}.`);
    return true;
  }
  bot.pathfinder.setMovements(new pf.Movements(bot));
  await bot.pathfinder.goto(new pf.goals.GoalNear(x, y, z, minDistance));
  log(bot, `You have reached at ${x}, ${y}, ${z}.`);
  return true;
}

export async function goToNearestBlock(
  bot: Bot,
  blockType: string,
  minDistance = 2,
  range = 64
): Promise<boolean> {
  const MAX_RANGE = 512;
  if (range > MAX_RANGE) {
    log(bot, `Maximum search range capped at ${MAX_RANGE}.`);
    range = MAX_RANGE;
  }
  const block = world.getNearestBlock(bot, blockType, range);
  if (!block) {
    log(bot, `Could not find any ${blockType} in ${range} blocks.`);
    return false;
  }
  log(bot, `Found ${blockType} at ${block.position}.`);
  await goToPosition(
    bot,
    block.position.x,
    block.position.y,
    block.position.z,
    minDistance
  );
  return true;
}

export async function goToPlayer(
  bot: ExtendedBot,
  username: string,
  distance = 3
): Promise<boolean> {
  if (bot.modes.isOn("cheat")) {
    bot.chat(`/tp @s ${username}`);
    log(bot, `Teleported to ${username}.`);
    return true;
  }

  bot.modes.pause("self_defense");
  bot.modes.pause("cowardice");
  const playerEntity = bot.players[username]?.entity;
  if (!playerEntity) {
    log(bot, `Could not find ${username}.`);
    return false;
  }

  const move = new pf.Movements(bot);
  bot.pathfinder.setMovements(move);
  await bot.pathfinder.goto(
    new pf.goals.GoalFollow(playerEntity, distance),
    true
  );

  log(bot, `You have reached ${username}.`);
  return true;
}

export async function followPlayer(
  bot: ExtendedBot,
  username: string,
  distance = 4
): Promise<boolean> {
  const playerEntity = bot.players[username]?.entity;
  if (!playerEntity) {
    return false;
  }

  const move = new pf.Movements(bot);
  bot.pathfinder.setMovements(move);
  bot.pathfinder.setGoal(new pf.goals.GoalFollow(playerEntity, distance), true);
  log(bot, `You are now actively following player ${username}.`);

  let lastTime = Date.now();
  let stuckTime = 0;
  let lastPos = bot.entity.position.clone();

  while (!bot.interrupt_code) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const delta = Date.now() - lastTime;
    // In cheat mode, if the distance is too far, teleport to the player
    if (
      bot.modes.isOn("cheat") &&
      bot.entity.position.distanceTo(playerEntity.position) > 100 &&
      playerEntity.onGround
    ) {
      await goToPlayer(bot, username);
    }
    if (bot.modes.isOn("unstuck")) {
      const farAway =
        bot.entity.position.distanceTo(playerEntity.position) > distance + 1;
      if (farAway && bot.entity.position.distanceTo(lastPos) <= 2) {
        stuckTime += delta;
        if (stuckTime > 10000) {
          log(bot, `Got stuck, attempting to move away.`);
          bot.pathfinder.stop();
          await moveAway(bot, 4);
          return false;
        }
      } else {
        stuckTime = 0;
        lastPos = bot.entity.position.clone();
      }
    }
    lastTime = Date.now();
  }
  return true;
}

export async function moveAway(
  bot: ExtendedBot,
  distance: number
): Promise<boolean> {
  const pos = bot.entity.position;
  const goal = new pf.goals.GoalNear(pos.x, pos.y, pos.z, distance);
  const invertedGoal = new pf.goals.GoalInvert(goal);
  bot.pathfinder.setMovements(new pf.Movements(bot));

  if (bot.modes.isOn("cheat")) {
    const move = new pf.Movements(bot);
    const path = await bot.pathfinder.getPathTo(move, invertedGoal, 10000);
    const lastMove = path?.path[path.path.length - 1];
    console.log(lastMove);
    if (lastMove) {
      const x = Math.floor(lastMove.x);
      const y = Math.floor(lastMove.y);
      const z = Math.floor(lastMove.z);
      bot.chat(`/tp @s ${x} ${y} ${z}`);
      return true;
    }
  }

  await bot.pathfinder.goto(invertedGoal);
  const newPos = bot.entity.position;
  log(bot, `Moved away from nearest entity to ${newPos}.`);
  return true;
}

export async function stay(bot: ExtendedBot): Promise<boolean> {
  bot.modes.pause("self_preservation");
  bot.modes.pause("cowardice");
  bot.modes.pause("self_defense");
  bot.modes.pause("hunting");
  bot.modes.pause("torch_placing");
  bot.modes.pause("item_collecting");
  while (!bot.interrupt_code) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return true;
}

export async function useDoor(
  bot: ExtendedBot,
  doorPos: Vec3 | null = null
): Promise<boolean> {
  if (!doorPos) {
    for (const doorType of [
      "oak_door",
      "spruce_door",
      "birch_door",
      "jungle_door",
      "acacia_door",
      "dark_oak_door",
      "mangrove_door",
      "cherry_door",
      "bamboo_door",
      "crimson_door",
      "warped_door",
    ]) {
      const doorBlock = world.getNearestBlock(bot, doorType, 16);
      if (doorBlock) {
        doorPos = doorBlock.position;
        break;
      }
    }
  }
  if (!doorPos) {
    log(bot, `Could not find a door to use.`);
    return false;
  }

  bot.pathfinder.setGoal(
    new pf.goals.GoalNear(doorPos.x, doorPos.y, doorPos.z, 1)
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  while (bot.pathfinder.isMoving()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const doorBlock = bot.blockAt(doorPos);
  if (!doorBlock) {
    log(bot, `No block found at the door position.`);
    return false;
  }
  await bot.lookAt(doorPos);
  if (!doorBlock.getProperties().open) {
    await bot.activateBlock(doorBlock);
  }

  bot.setControlState("forward", true);
  await new Promise((resolve) => setTimeout(resolve, 600));
  bot.setControlState("forward", false);
  await bot.activateBlock(doorBlock);

  log(bot, `Used door at ${doorPos}.`);
  return true;
}

export async function goToBed(bot: ExtendedBot): Promise<boolean> {
  const beds = bot.findBlocks({
    matching: (block) => block.name.includes("bed"),
    maxDistance: 32,
    count: 1,
  });
  if (beds.length === 0) {
    log(bot, `Could not find a bed to sleep in.`);
    return false;
  }
  const loc = beds[0];
  await goToPosition(bot, loc.x, loc.y, loc.z);
  const bed = bot.blockAt(loc);
  if (!bed) {
    log(bot, `No bed found at the specified location.`);
    return false;
  }
  try {
    await bot.sleep(bed);
    log(bot, `You are in bed.`);
    while (bot.isSleeping) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    log(bot, `You have woken up.`);
    return true;
  } catch (err) {
    log(bot, `Failed to sleep: ${(err as Error).message}`);
    return false;
  }
}
