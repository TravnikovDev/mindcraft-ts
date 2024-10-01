import minecraftData, {
  Biome,
  Recipe,
  ShapedRecipe,
  ShapelessRecipe,
} from "minecraft-data";
import settings from "../../settings.js";
import { createBot, Bot, BotOptions } from "mineflayer";
import prismarineItem from "prismarine-item";
import { pathfinder } from "mineflayer-pathfinder";
import { plugin as pvp } from "mineflayer-pvp";
import { plugin as collectBlock } from "mineflayer-collectblock";
import { plugin as autoEat } from "mineflayer-auto-eat";
import armorManager from "mineflayer-armor-manager";
import { Entity } from "prismarine-entity";

const mc_version: string = settings.minecraft_version;
const mcdata = minecraftData(mc_version);
const Item = prismarineItem(mc_version);

export const WOOD_TYPES: string[] = [
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
];

export const MATCHING_WOOD_BLOCKS: string[] = [
  "log",
  "planks",
  "sign",
  "boat",
  "fence_gate",
  "door",
  "fence",
  "slab",
  "stairs",
  "button",
  "pressure_plate",
  "trapdoor",
];

export const WOOL_COLORS: string[] = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
];

export function initBot(username: string): Bot {
  const botOptions: BotOptions = {
    username: username,
    host: settings.host,
    port: settings.port,
    auth: settings.auth as "offline" | "microsoft",
    version: mc_version,
  };

  const bot: Bot = createBot(botOptions);

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(armorManager);

  return bot;
}

export function isHuntable(mob: Entity): boolean {
  if (!mob || !mob.name) return false;
  const animals: string[] = [
    "chicken",
    "cow",
    "llama",
    "mooshroom",
    "pig",
    "rabbit",
    "sheep",
  ];
  return animals.includes(mob.name.toLowerCase()) && !mob.metadata[16]; // metadata[16] indicates baby status
}

export function isHostile(mob: Entity): boolean {
  if (!mob || !mob.name) return false;
  return (
    (mob.type === "mob" || mob.type === "hostile") &&
    mob.name !== "iron_golem" &&
    mob.name !== "snow_golem"
  );
}

export function getItemId(itemName: string): number {
  const item = mcdata.itemsByName[itemName];

  return item.id || 0;
}

export function getItemName(itemId: number): string {
  const item = mcdata.items[itemId];
  return item.name || "";
}

export function getBlockId(blockName: string): number {
  const block = mcdata.blocksByName[blockName];
  return block.id || 0;
}

export function getBlockName(blockId: number): string {
  const block = mcdata.blocks[blockId];
  return block.name || "";
}

export function getAllItems(ignore: string[] = []): any[] {
  const items: any[] = [];
  for (const itemId in mcdata.items) {
    const item = mcdata.items[itemId];
    if (!ignore.includes(item.name)) {
      items.push(item);
    }
  }
  return items;
}

export function getAllItemIds(ignore: string[] = []): number[] {
  const items = getAllItems(ignore);
  const itemIds: number[] = [];
  for (const item of items) {
    itemIds.push(item.id);
  }
  return itemIds;
}

export function getAllBlocks(ignore: string[] = []): any[] {
  const blocks: any[] = [];
  for (const blockId in mcdata.blocks) {
    const block = mcdata.blocks[blockId];
    if (!ignore.includes(block.name)) {
      blocks.push(block);
    }
  }
  return blocks;
}

export function getAllBlockIds(ignore: string[] = []): number[] {
  const blocks = getAllBlocks(ignore);
  const blockIds: number[] = [];
  for (const block of blocks) {
    blockIds.push(block.id);
  }
  return blockIds;
}

export function getAllBiomes(): Record<number, Biome> {
  return mcdata.biomes;
}

export function getItemCraftingRecipes(itemName: string): any[] | null {
  const itemId = getItemId(itemName);
  if (!itemId || !mcdata.recipes[itemId]) {
    return null;
  }

  const recipes: Record<string, number>[] = [];
  for (const r of mcdata.recipes[itemId]) {
    const recipe: Record<string, number> = {};
    let ingredients: number[] = [];

    if (isShapelessRecipe(r)) {
      // Handle shapeless recipe
      ingredients = r.ingredients.map((ing: any) => ing.id);
    } else if (isShapedRecipe(r)) {
      // Handle shaped recipe
      ingredients = r.inShape
        .flat()
        .map((ing: any) => ing?.id)
        .filter(Boolean);
    }

    for (const ingredientId of ingredients) {
      const ingredientName = getItemName(ingredientId);
      if (ingredientName === null) continue;
      if (!recipe[ingredientName]) recipe[ingredientName] = 0;
      recipe[ingredientName]++;
    }

    recipes.push(recipe);
  }

  return recipes;
}

// Type guards
function isShapelessRecipe(recipe: any): recipe is ShapelessRecipe {
  return "ingredients" in recipe;
}

function isShapedRecipe(recipe: any): recipe is ShapedRecipe {
  return "inShape" in recipe;
}

export function getItemSmeltingIngredient(
  itemName: string
): string | undefined {
  return {
    baked_potato: "potato",
    steak: "raw_beef",
    cooked_chicken: "raw_chicken",
    cooked_cod: "raw_cod",
    cooked_mutton: "raw_mutton",
    cooked_porkchop: "raw_porkchop",
    cooked_rabbit: "raw_rabbit",
    cooked_salmon: "raw_salmon",
    dried_kelp: "kelp",
    iron_ingot: "raw_iron",
    gold_ingot: "raw_gold",
    copper_ingot: "raw_copper",
    glass: "sand",
  }[itemName];
}

export function getItemBlockSources(itemName: string): string[] {
  const itemId = getItemId(itemName);
  const sources: string[] = [];
  if (!itemId) return sources;
  for (const block of getAllBlocks()) {
    if (block.drops && block.drops.includes(itemId)) {
      sources.push(block.name);
    }
  }
  return sources;
}

export function getItemAnimalSource(itemName: string): string | undefined {
  return {
    raw_beef: "cow",
    raw_chicken: "chicken",
    raw_cod: "cod",
    raw_mutton: "sheep",
    raw_porkchop: "pig",
    raw_rabbit: "rabbit",
    raw_salmon: "salmon",
    leather: "cow",
    wool: "sheep",
  }[itemName];
}

export function getBlockTool(blockName: string): string | null {
  const block = mcdata.blocksByName[blockName];
  if (!block || !block.harvestTools) {
    return null;
  }
  const toolIds = Object.keys(block.harvestTools).map((id) => parseInt(id));
  const toolName = getItemName(toolIds[0]);
  return toolName || null; // Assuming the first tool is the simplest
}

export function makeItem(name: string, amount = 1): InstanceType<typeof Item> {
  const itemId = getItemId(name);
  if (itemId === null) throw new Error(`Item ${name} not found.`);
  return new Item(itemId, amount);
}
