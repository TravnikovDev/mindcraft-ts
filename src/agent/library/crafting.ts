// src/agent/library/skills/crafting.ts

import { Bot, Recipe, Item } from "mineflayer";
import { log } from "./utility";
import * as mc from "../../utils/mcdata.js";
import * as world from "./world.js";
import { goToNearestBlock } from "./movement";
import { collectBlock, placeBlock } from "./worldInteraction";
import { Vec3 } from "vec3";
import { ExtendedBot } from "../../types";

export async function craftRecipe(
  bot: ExtendedBot,
  itemName: string,
  num = 1
): Promise<boolean> {
  let placedTable = false;

  if (itemName.endsWith("plank")) itemName += "s"; // Correct common mistakes

  // Get recipes that don't require a crafting table
  let recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, null);
  let craftingTable = null;
  const craftingTableRange = 32;
  if (!recipes || recipes.length === 0) {
    // Look for crafting table
    craftingTable = world.getNearestBlock(
      bot,
      "crafting_table",
      craftingTableRange
    );
    if (!craftingTable) {
      // Try to place crafting table
      const hasTable = world.getInventoryCounts(bot)["crafting_table"] > 0;
      if (hasTable) {
        const pos = world.getNearestFreeSpace(bot, 1, 6);
        await placeBlock(bot, "crafting_table", pos.x, pos.y, pos.z);
        craftingTable = world.getNearestBlock(
          bot,
          "crafting_table",
          craftingTableRange
        );
        if (craftingTable) {
          recipes = bot.recipesFor(
            mc.getItemId(itemName),
            null,
            1,
            craftingTable
          );
          placedTable = true;
        }
      } else {
        log(
          bot,
          `You either do not have enough resources to craft ${itemName} or it requires a crafting table.`
        );
        return false;
      }
    } else {
      recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, craftingTable);
    }
  }
  if (!recipes || recipes.length === 0) {
    log(bot, `You do not have the resources to craft a ${itemName}.`);
    if (placedTable) {
      await collectBlock(bot, "crafting_table", 1);
    }
    return false;
  }

  if (
    craftingTable &&
    bot.entity.position.distanceTo(craftingTable.position) > 4
  ) {
    await goToNearestBlock(bot, "crafting_table", 4, craftingTableRange);
  }

  const recipe = recipes[0];
  console.log("crafting...");
  try {
    await bot.craft(recipe, num, craftingTable);
    const invCounts = world.getInventoryCounts(bot);
    const itemCount = invCounts[itemName] || 0;
    log(
      bot,
      `Successfully crafted ${itemName}, you now have ${itemCount} ${itemName}.`
    );
    if (placedTable) {
      await collectBlock(bot, "crafting_table", 1);
    }
    return true;
  } catch (err) {
    log(bot, `Failed to craft ${itemName}: ${err.message}`);
    if (placedTable) {
      await collectBlock(bot, "crafting_table", 1);
    }
    return false;
  }
}

export async function smeltItem(
  bot: ExtendedBot,
  itemName: string,
  num = 1
): Promise<boolean> {
  const foods = [
    "beef",
    "chicken",
    "cod",
    "mutton",
    "porkchop",
    "rabbit",
    "salmon",
    "tropical_fish",
  ];
  if (!itemName.includes("raw") && !foods.includes(itemName)) {
    log(
      bot,
      `Cannot smelt ${itemName}, must be a "raw" item, like "raw_iron".`
    );
    return false;
  } // TODO: allow cobblestone, sand, clay, etc.

  let placedFurnace = false;
  let furnaceBlock = world.getNearestBlock(bot, "furnace", 32);
  if (!furnaceBlock) {
    // Try to place furnace
    const hasFurnace = world.getInventoryCounts(bot)["furnace"] > 0;
    if (hasFurnace) {
      const pos = world.getNearestFreeSpace(bot, 1, 32);
      await placeBlock(bot, "furnace", pos.x, pos.y, pos.z);
      furnaceBlock = world.getNearestBlock(bot, "furnace", 32);
      placedFurnace = true;
    }
  }
  if (!furnaceBlock) {
    log(bot, `There is no furnace nearby and you have no furnace.`);
    return false;
  }
  if (bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToNearestBlock(bot, "furnace", 4, 32);
  }
  await bot.lookAt(furnaceBlock.position);

  console.log("smelting...");
  const furnace = await bot.openFurnace(furnaceBlock);
  // Check if the furnace is already smelting something
  const inputItem = furnace.inputItem();
  if (
    inputItem &&
    inputItem.type !== mc.getItemId(itemName) &&
    inputItem.count > 0
  ) {
    log(
      bot,
      `The furnace is currently smelting ${mc.getItemName(inputItem.type)}.`
    );
    if (placedFurnace) await collectBlock(bot, "furnace", 1);
    return false;
  }
  // Check if the bot has enough items to smelt
  const invCounts = world.getInventoryCounts(bot);
  if (!invCounts[itemName] || invCounts[itemName] < num) {
    log(bot, `You do not have enough ${itemName} to smelt.`);
    if (placedFurnace) await collectBlock(bot, "furnace", 1);
    return false;
  }

  // Fuel the furnace
  if (!furnace.fuelItem()) {
    const fuel = bot.inventory
      .items()
      .find((item) => item.name === "coal" || item.name === "charcoal");
    const putFuel = Math.ceil(num / 8);
    if (!fuel || fuel.count < putFuel) {
      log(
        bot,
        `You do not have enough coal or charcoal to smelt ${num} ${itemName}, you need ${putFuel} coal or charcoal`
      );
      if (placedFurnace) await collectBlock(bot, "furnace", 1);
      return false;
    }
    await furnace.putFuel(fuel.type, null, putFuel);
    log(bot, `Added ${putFuel} ${mc.getItemName(fuel.type)} to furnace fuel.`);
  }
  // Put the items in the furnace
  await furnace.putInput(mc.getItemId(itemName), null, num);
  // Wait for the items to smelt
  let total = 0;
  let collectedLast = true;
  let smeltedItem: Item | null = null;
  await new Promise((resolve) => setTimeout(resolve, 200));
  while (total < num) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("checking...");
    let collected = false;
    if (furnace.outputItem()) {
      smeltedItem = await furnace.takeOutput();
      if (smeltedItem) {
        total += smeltedItem.count;
        collected = true;
      }
    }
    if (!collected && !collectedLast) {
      break; // if nothing was collected this time or last time
    }
    collectedLast = collected;
    if (bot.interrupt_code) {
      break;
    }
  }
  await bot.closeWindow(furnace);

  if (placedFurnace) {
    await collectBlock(bot, "furnace", 1);
  }
  if (total === 0) {
    log(bot, `Failed to smelt ${itemName}.`);
    return false;
  }
  if (total < num) {
    log(
      bot,
      `Only smelted ${total} ${mc.getItemName(smeltedItem?.type || 0)}.`
    );
    return false;
  }
  log(
    bot,
    `Successfully smelted ${itemName}, got ${total} ${mc.getItemName(
      smeltedItem?.type || 0
    )}.`
  );
  return true;
}

export async function clearNearestFurnace(bot: ExtendedBot): Promise<boolean> {
  const furnaceBlock = world.getNearestBlock(bot, "furnace", 6);
  if (!furnaceBlock) {
    log(bot, `There is no furnace nearby.`);
    return false;
  }

  console.log("clearing furnace...");
  const furnace = await bot.openFurnace(furnaceBlock);
  console.log("opened furnace...");
  // Take the items out of the furnace
  let smeltedItem: Item | null = null;
  let inputItem: Item | null = null;
  let fuelItem: Item | null = null;
  if (furnace.outputItem()) smeltedItem = await furnace.takeOutput();
  if (furnace.inputItem()) inputItem = await furnace.takeInput();
  if (furnace.fuelItem()) fuelItem = await furnace.takeFuel();
  console.log(smeltedItem, inputItem, fuelItem);
  const smeltedName = smeltedItem
    ? `${smeltedItem.count} ${smeltedItem.name}`
    : `0 smelted items`;
  const inputName = inputItem
    ? `${inputItem.count} ${inputItem.name}`
    : `0 input items`;
  const fuelName = fuelItem
    ? `${fuelItem.count} ${fuelItem.name}`
    : `0 fuel items`;
  log(
    bot,
    `Cleared furnace, received ${smeltedName}, ${inputName}, and ${fuelName}.`
  );
  await bot.closeWindow(furnace);
  return true;
}
