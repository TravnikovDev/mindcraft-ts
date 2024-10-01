// src/agent/library/skills/combat.ts

import { Entity } from "prismarine-entity";
import pf from "mineflayer-pathfinder";
import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import { log } from "./utility.js";
import { goToPosition } from "./movement.js";
import { pickupNearbyItems } from "./worldInteraction.js";
import { ExtendedBot } from "../../types/index.js";

export async function attackNearest(
  bot: ExtendedBot,
  mobType: string,
  kill = true
): Promise<boolean> {
  bot.modes.pause("cowardice");
  const mob = world
    .getNearbyEntities(bot, 24)
    .find((entity: Entity) => entity.name === mobType);
  if (mob) {
    return await attackEntity(bot, mob, kill);
  }
  log(bot, "Could not find any " + mobType + " to attack.");
  return false;
}

export async function attackEntity(
  bot: ExtendedBot,
  entity: Entity,
  kill = true
): Promise<boolean> {
  const pos = entity.position;
  console.log(bot.entity.position.distanceTo(pos));

  await equipHighestAttack(bot);

  if (!kill) {
    if (bot.entity.position.distanceTo(pos) > 5) {
      console.log("Moving to mob...");
      await goToPosition(bot, pos.x, pos.y, pos.z);
    }
    console.log("Attacking mob...");
    await bot.attack(entity);
  } else {
    bot.pvp.attack(entity);
    while (
      world.getNearbyEntities(bot, 24).some((e: Entity) => e.id === entity.id)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (bot.interrupt_code) {
        bot.pvp.stop();
        return false;
      }
    }
    log(bot, `Successfully killed ${entity.name}.`);
    await pickupNearbyItems(bot);
    return true;
  }
  return true;
}

export async function defendSelf(
  bot: ExtendedBot,
  range = 9
): Promise<boolean> {
  bot.modes.pause("self_defense");
  bot.modes.pause("cowardice");
  let attacked = false;
  let enemy = world.getNearestEntityWhere(
    bot,
    (entity: Entity) => mc.isHostile(entity),
    range
  );
  while (enemy) {
    await equipHighestAttack(bot);
    if (
      bot.entity.position.distanceTo(enemy.position) > 4 &&
      enemy.name !== "creeper" &&
      enemy.name !== "phantom"
    ) {
      try {
        bot.pathfinder.setMovements(new pf.Movements(bot));
        await bot.pathfinder.goto(new pf.goals.GoalFollow(enemy, 2), () => {});
      } catch (err) {
        // Might error if entity dies, ignore
      }
    }
    bot.pvp.attack(enemy);
    attacked = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    enemy = world.getNearestEntityWhere(
      bot,
      (entity: Entity) => mc.isHostile(entity),
      range
    );
    if (bot.interrupt_code) {
      bot.pvp.stop();
      return false;
    }
  }
  bot.pvp.stop();
  if (attacked) {
    log(bot, `Successfully defended self.`);
  } else {
    log(bot, `No enemies nearby to defend self from.`);
  }
  return attacked;
}

export async function avoidEnemies(
  bot: ExtendedBot,
  distance = 16
): Promise<boolean> {
  bot.modes.pause("self_preservation"); // Prevents damage-on-low-health from interrupting the bot
  let enemy = world.getNearestEntityWhere(
    bot,
    (entity: Entity) => mc.isHostile(entity),
    distance
  );
  while (enemy) {
    const follow = new pf.goals.GoalFollow(enemy, distance + 1); // Move a little further away
    const invertedGoal = new pf.goals.GoalInvert(follow);
    bot.pathfinder.setMovements(new pf.Movements(bot));
    bot.pathfinder.setGoal(invertedGoal, true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    enemy = world.getNearestEntityWhere(
      bot,
      (entity: Entity) => mc.isHostile(entity),
      distance
    );
    if (bot.interrupt_code) {
      break;
    }
  }
  bot.pathfinder.stop();
  log(bot, `Moved ${distance} away from enemies.`);
  return true;
}

export async function equipHighestAttack(bot: ExtendedBot): Promise<void> {
  let weapons = bot.inventory
    .items()
    .filter(
      (item) =>
        item.name.includes("sword") ||
        (item.name.includes("axe") && !item.name.includes("pickaxe"))
    );
  if (weapons.length === 0)
    weapons = bot.inventory
      .items()
      .filter(
        (item) => item.name.includes("pickaxe") || item.name.includes("shovel")
      );
  if (weapons.length === 0) return;

  // @ts-ignore
  weapons.sort((a, b) => a.attackDamage < b.attackDamage);
  let weapon = weapons[0];
  if (weapon) await bot.equip(weapon, "hand");
}
