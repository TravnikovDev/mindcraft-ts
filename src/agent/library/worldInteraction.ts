// src/agent/library/skills/worldInteraction.ts

import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import pf from "mineflayer-pathfinder";
import { log } from "./utility";
import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import { ExtendedBot } from "../../types";

// Move functions like placeBlock, breakBlockAt, collectBlock, etc.

export async function placeBlock(
  bot: ExtendedBot,
  blockType: string,
  x: number,
  y: number,
  z: number,
  placeOn: string = "bottom",
  dontCheat: boolean = false
): Promise<boolean> {
  if (!mc.getBlockId(blockType)) {
    log(bot, `Invalid block type: ${blockType}.`);
    return false;
  }

  const targetDest = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));

  if (bot.modes.isOn("cheat") && !dontCheat) {
    // Handle cheat mode placement
    let face =
      {
        north: "south",
        south: "north",
        east: "west",
        west: "east",
      }[placeOn] || "north";

    let modifiedBlockType = blockType;
    if (blockType.includes("torch") && placeOn !== "bottom") {
      modifiedBlockType = blockType.replace("torch", "wall_torch");
      if (placeOn !== "side" && placeOn !== "top") {
        modifiedBlockType += `[facing=${face}]`;
      }
    }
    if (blockType.includes("button") || blockType === "lever") {
      if (placeOn === "top") {
        modifiedBlockType += `[face=ceiling]`;
      } else if (placeOn === "bottom") {
        modifiedBlockType += `[face=floor]`;
      } else {
        modifiedBlockType += `[facing=${face}]`;
      }
    }
    if (
      blockType === "ladder" ||
      blockType === "repeater" ||
      blockType === "comparator"
    ) {
      modifiedBlockType += `[facing=${face}]`;
    }

    const commands = [`/setblock ${x} ${y} ${z} ${modifiedBlockType}`];

    if (blockType.includes("door")) {
      commands.push(
        `/setblock ${x} ${y + 1} ${z} ${modifiedBlockType}[half=upper]`
      );
    }

    if (blockType.includes("bed")) {
      commands.push(
        `/setblock ${x} ${y} ${z - 1} ${modifiedBlockType}[part=head]`
      );
    }

    for (const cmd of commands) {
      bot.chat(cmd);
    }

    log(bot, `Used /setblock to place ${modifiedBlockType} at ${targetDest}.`);
    return true;
  }

  let block = bot.inventory.items().find((item) => item.name === blockType);
  if (!block && bot.game.gameMode === "creative") {
    await bot.creative.setInventorySlot(36, mc.makeItem(blockType, 1)); // 36 is first hotbar slot
    block = bot.inventory.items().find((item) => item.name === blockType);
  }
  if (!block) {
    log(bot, `Don't have any ${blockType} to place.`);
    return false;
  }

  const targetBlock = bot.blockAt(targetDest);
  if (!targetBlock) {
    log(bot, `No block found at ${targetDest}.`);
    return false;
  }

  if (targetBlock.name === blockType) {
    log(bot, `${blockType} already at ${targetBlock.position}.`);
    return false;
  }

  const emptyBlocks = [
    "air",
    "water",
    "lava",
    "grass",
    "tall_grass",
    "snow",
    "dead_bush",
    "fern",
  ];
  if (!emptyBlocks.includes(targetBlock.name)) {
    log(bot, `${targetBlock.name} is in the way at ${targetBlock.position}.`);
    const removed = await breakBlockAt(bot, x, y, z);
    if (!removed) {
      log(
        bot,
        `Cannot place ${blockType} at ${targetBlock.position}: block in the way.`
      );
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for block to break
  }

  // Determine the build-off block and face vector
  const dirMap: { [key: string]: Vec3 } = {
    top: new Vec3(0, 1, 0),
    bottom: new Vec3(0, -1, 0),
    north: new Vec3(0, 0, -1),
    south: new Vec3(0, 0, 1),
    east: new Vec3(1, 0, 0),
    west: new Vec3(-1, 0, 0),
  };

  let dirs: Vec3[] = [];
  if (placeOn === "side") {
    dirs.push(dirMap["north"], dirMap["south"], dirMap["east"], dirMap["west"]);
  } else if (dirMap[placeOn]) {
    dirs.push(dirMap[placeOn]);
  } else {
    dirs.push(dirMap["bottom"]);
    log(bot, `Unknown placeOn value "${placeOn}". Defaulting to bottom.`);
  }

  // Add remaining directions
  dirs.push(...Object.values(dirMap).filter((d) => !dirs.includes(d)));

  let buildOffBlock: Block | null = null;
  let faceVec: Vec3 | null = null;

  for (const d of dirs) {
    const adjacentBlock = bot.blockAt(targetDest.plus(d));
    if (adjacentBlock && !emptyBlocks.includes(adjacentBlock.name)) {
      buildOffBlock = adjacentBlock;
      faceVec = d.scaled(-1); // Invert direction
      break;
    }
  }

  if (!buildOffBlock || !faceVec) {
    log(
      bot,
      `Cannot place ${blockType} at ${targetBlock.position}: nothing to place on.`
    );
    return false;
  }

  // Move away if too close
  const pos = bot.entity.position;
  const posAbove = pos.offset(0, 1, 0);
  const dontMoveFor = [
    "torch",
    "redstone_torch",
    "redstone",
    "lever",
    "button",
    "rail",
    "detector_rail",
    "powered_rail",
    "activator_rail",
    "tripwire_hook",
    "tripwire",
    "water_bucket",
  ];
  if (
    !dontMoveFor.includes(blockType) &&
    (pos.distanceTo(targetBlock.position) < 1 ||
      posAbove.distanceTo(targetBlock.position) < 1)
  ) {
    const goal = new pf.goals.GoalInvert(
      new pf.goals.GoalNear(
        targetBlock.position.x,
        targetBlock.position.y,
        targetBlock.position.z,
        2
      )
    );
    bot.pathfinder.setMovements(new pf.Movements(bot));
    await bot.pathfinder.goto(goal);
  }

  // Move closer if too far
  if (bot.entity.position.distanceTo(targetBlock.position) > 4.5) {
    await goToPosition(
      bot,
      targetBlock.position.x,
      targetBlock.position.y,
      targetBlock.position.z,
      4
    );
  }

  await bot.equip(block, "hand");
  await bot.lookAt(buildOffBlock.position);

  try {
    await bot.placeBlock(buildOffBlock, faceVec);
    log(bot, `Placed ${blockType} at ${targetDest}.`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  } catch (err) {
    log(bot, `Failed to place ${blockType} at ${targetDest}: ${err.message}`);
    return false;
  }
}

export async function breakBlockAt(
  bot: ExtendedBot,
  x: number,
  y: number,
  z: number
): Promise<boolean> {
  if (x == null || y == null || z == null) {
    throw new Error("Invalid position to break block at.");
  }
  const blockPos = new Vec3(x, y, z);
  const block = bot.blockAt(blockPos);
  if (!block) {
    log(bot, `No block found at position ${blockPos}.`);
    return false;
  }
  if (block.name !== "air" && block.name !== "water" && block.name !== "lava") {
    if (bot.modes.isOn("cheat")) {
      const msg = `/setblock ${x} ${y} ${z} air`;
      bot.chat(msg);
      log(bot, `Used /setblock to break block at ${x}, ${y}, ${z}.`);
      return true;
    }

    if (bot.entity.position.distanceTo(block.position) > 4.5) {
      await goToPosition(bot, x, y, z, 4);
    }
    if (bot.game.gameMode !== "creative") {
      await bot.tool.equipForBlock(block);
      const itemId = bot.heldItem ? bot.heldItem.type : null;
      if (!block.canHarvest(itemId)) {
        log(bot, `Don't have right tools to break ${block.name}.`);
        return false;
      }
    }
    await bot.dig(block, true);
    log(
      bot,
      `Broke ${block.name} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`
    );
    return true;
  } else {
    log(
      bot,
      `Skipping block at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)} because it is ${block.name}.`
    );
    return false;
  }
}

export async function collectBlock(
  bot: ExtendedBot,
  blockType: string,
  num = 1,
  exclude: Vec3[] = []
): Promise<boolean> {
  if (num < 1) {
    log(bot, `Invalid number of blocks to collect: ${num}.`);
    return false;
  }

  let blockTypes = [blockType];
  // Add variants
  if (
    [
      "coal",
      "diamond",
      "emerald",
      "iron",
      "gold",
      "lapis_lazuli",
      "redstone",
    ].includes(blockType)
  ) {
    blockTypes.push(`${blockType}_ore`);
  }
  if (blockType.endsWith("ore")) {
    blockTypes.push(`deepslate_${blockType}`);
  }
  if (blockType === "dirt") {
    blockTypes.push("grass_block");
  }

  let collected = 0;

  for (let i = 0; i < num; i++) {
    let blocks = world.getNearestBlocks(bot, blockTypes, 64);
    if (exclude.length > 0) {
      blocks = blocks.filter(
        (block) =>
          !exclude.some(
            (pos) =>
              pos.x === block.position.x &&
              pos.y === block.position.y &&
              pos.z === block.position.z
          )
      );
    }
    const movements = new pf.Movements(bot);
    movements.dontMineUnderFallingBlock = false;
    blocks = blocks.filter((block) => movements.safeToBreak(block));

    if (blocks.length === 0) {
      if (collected === 0) log(bot, `No ${blockType} nearby to collect.`);
      else log(bot, `No more ${blockType} nearby to collect.`);
      break;
    }
    const block = blocks[0];
    await bot.tool.equipForBlock(block);
    const itemId = bot.heldItem ? bot.heldItem.type : null;
    if (!block.canHarvest(itemId)) {
      log(bot, `Don't have right tools to harvest ${blockType}.`);
      return false;
    }
    try {
      await bot.collectBlock.collect(block);
      collected++;
      await autoLight(bot);
    } catch (err) {
      if (err.name === "NoChests") {
        log(
          bot,
          `Failed to collect ${blockType}: Inventory full, no place to deposit.`
        );
        break;
      } else {
        log(bot, `Failed to collect ${blockType}: ${err.message}.`);
        continue;
      }
    }

    if (bot.interrupt_code) break;
  }
  log(bot, `Collected ${collected} ${blockType}.`);
  return collected > 0;
}

export async function activateNearestBlock(bot: ExtendedBot, type: string) {
  /**
   * Activate the nearest block of the given type.
   * @param {MinecraftBot} bot, reference to the minecraft bot.
   * @param {string} type, the type of block to activate.
   * @returns {Promise<boolean>} true if the block was activated, false otherwise.
   * @example
   * await skills.activateNearestBlock(bot, "lever");
   * **/
  let block = world.getNearestBlock(bot, type, 16);
  if (!block) {
    log(bot, `Could not find any ${type} to activate.`);
    return false;
  }
  if (bot.entity.position.distanceTo(block.position) > 4.5) {
    let pos = block.position;
    bot.pathfinder.setMovements(new pf.Movements(bot));
    await bot.pathfinder.goto(new pf.goals.GoalNear(pos.x, pos.y, pos.z, 4));
  }
  await bot.activateBlock(block);
  log(
    bot,
    `Activated ${type} at x:${block.position.x.toFixed(1)}, y:${block.position.y.toFixed(1)}, z:${block.position.z.toFixed(1)}.`
  );
  return true;
}

export async function tillAndSow(
  bot: ExtendedBot,
  x: number,
  y: number,
  z: number,
  seedType: string | null = null
): Promise<boolean> {
  x = Math.round(x);
  y = Math.round(y);
  z = Math.round(z);
  const blockPos = new Vec3(x, y, z);
  const block = bot.blockAt(blockPos);
  if (!block) {
    log(bot, `No block found at ${blockPos}.`);
    return false;
  }
  if (
    block.name !== "grass_block" &&
    block.name !== "dirt" &&
    block.name !== "farmland"
  ) {
    log(bot, `Cannot till ${block.name}, must be grass_block or dirt.`);
    return false;
  }
  const above = bot.blockAt(blockPos.offset(0, 1, 0));
  if (above && above.name !== "air") {
    log(bot, `Cannot till, there is ${above.name} above the block.`);
    return false;
  }
  // Move closer if too far
  if (bot.entity.position.distanceTo(block.position) > 4.5) {
    await goToPosition(bot, x, y, z, 4);
  }
  if (block.name !== "farmland") {
    const hoe = bot.inventory.items().find((item) => item.name.includes("hoe"));
    if (!hoe) {
      log(bot, `Cannot till, no hoes.`);
      return false;
    }
    await bot.equip(hoe, "hand");
    await bot.activateBlock(block);
    log(
      bot,
      `Tilled block x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`
    );
  }

  if (seedType) {
    if (seedType.endsWith("seed") && !seedType.endsWith("seeds"))
      seedType += "s"; // Fixes common mistake
    const seeds = bot.inventory.items().find((item) => item.name === seedType);
    if (!seeds) {
      log(bot, `No ${seedType} to plant.`);
      return false;
    }
    await bot.equip(seeds, "hand");
    await bot.placeBlock(block, new Vec3(0, -1, 0));
    log(
      bot,
      `Planted ${seedType} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`
    );
  }
  return true;
}

export async function pickupNearbyItems(bot: ExtendedBot): Promise<boolean> {
  const distance = 8;
  const getNearestItem = (bot: Bot) =>
    bot.nearestEntity(
      (entity) =>
        entity.name === "item" &&
        bot.entity.position.distanceTo(entity.position) < distance
    );
  let nearestItem = getNearestItem(bot);
  let pickedUp = 0;
  while (nearestItem) {
    bot.pathfinder.setMovements(new pf.Movements(bot));
    await bot.pathfinder.goto(new pf.goals.GoalFollow(nearestItem, 0.8), true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const prev = nearestItem;
    nearestItem = getNearestItem(bot);
    if (prev === nearestItem) {
      break;
    }
    pickedUp++;
  }
  log(bot, `Picked up ${pickedUp} items.`);
  return true;
}
