// src/agent/npc/item_goal.ts

import * as world from "../library/world";
import * as mc from "../../utils/mcdata";
import { itemSatisfied } from "./utils";
import { Agent } from "../agent"; // Assuming Agent interface is defined
import { skills } from "../library";

const blacklist = [
  "coal_block",
  "iron_block",
  "gold_block",
  "diamond_block",
  "deepslate",
  "blackstone",
  "netherite",
  "_wood",
  "stripped_",
  "crimson",
  "warped",
  "dye",
];

class ItemNode {
  manager: ItemGoal;
  wrapper: ItemWrapper;
  name: string;
  type: string;
  source: string | null;
  prereq: ItemWrapper | null;
  recipe: { node: ItemWrapper; quantity: number }[];
  fails: number;

  constructor(manager: ItemGoal, wrapper: ItemWrapper, name: string) {
    this.manager = manager;
    this.wrapper = wrapper;
    this.name = name;
    this.type = "";
    this.source = null;
    this.prereq = null;
    this.recipe = [];
    this.fails = 0;
  }

  setRecipe(recipe: { [key: string]: number }): this {
    this.type = "craft";
    let size = 0;
    this.recipe = [];
    for (const [key, value] of Object.entries(recipe)) {
      if (this.manager.nodes[key] === undefined)
        this.manager.nodes[key] = new ItemWrapper(
          this.manager,
          this.wrapper,
          key
        );
      this.recipe.push({ node: this.manager.nodes[key], quantity: value });
      size += value;
    }
    if (size > 4) {
      if (this.manager.nodes["crafting_table"] === undefined)
        this.manager.nodes["crafting_table"] = new ItemWrapper(
          this.manager,
          this.wrapper,
          "crafting_table"
        );
      this.prereq = this.manager.nodes["crafting_table"];
    }
    return this;
  }

  setCollectable(
    source: string | null = null,
    tool: string | null = null
  ): this {
    this.type = "block";
    if (source) this.source = source;
    else this.source = this.name;
    if (tool) {
      if (this.manager.nodes[tool] === undefined)
        this.manager.nodes[tool] = new ItemWrapper(
          this.manager,
          this.wrapper,
          tool
        );
      this.prereq = this.manager.nodes[tool];
    }
    return this;
  }

  setSmeltable(source_item: string): this {
    this.type = "smelt";
    if (this.manager.nodes["furnace"] === undefined)
      this.manager.nodes["furnace"] = new ItemWrapper(
        this.manager,
        this.wrapper,
        "furnace"
      );
    this.prereq = this.manager.nodes["furnace"];

    if (this.manager.nodes[source_item] === undefined)
      this.manager.nodes[source_item] = new ItemWrapper(
        this.manager,
        this.wrapper,
        source_item
      );
    if (this.manager.nodes["coal"] === undefined)
      this.manager.nodes["coal"] = new ItemWrapper(
        this.manager,
        this.wrapper,
        "coal"
      );
    this.recipe = [
      { node: this.manager.nodes[source_item], quantity: 1 },
      { node: this.manager.nodes["coal"], quantity: 1 },
    ];
    return this;
  }

  setHuntable(animal_source: string): this {
    this.type = "hunt";
    this.source = animal_source;
    return this;
  }

  getChildren(): { node: ItemWrapper; quantity: number }[] {
    const children = [...this.recipe];
    if (this.prereq) {
      children.push({ node: this.prereq, quantity: 1 });
    }
    return children;
  }

  isReady(): boolean {
    for (const child of this.getChildren()) {
      if (!child.node.isDone(child.quantity)) {
        return false;
      }
    }
    return true;
  }

  isDone(quantity = 1): boolean {
    if (this.manager.goal && this.manager.goal.name === this.name) return false;
    return itemSatisfied(this.manager.agent.bot, this.name, quantity);
  }

  getDepth(q = 1): number {
    if (this.isDone(q)) {
      return 0;
    }
    let depth = 0;
    for (const child of this.getChildren()) {
      depth = Math.max(depth, child.node.getDepth(child.quantity));
    }
    return depth + 1;
  }

  getFails(q = 1): number {
    if (this.isDone(q)) {
      return 0;
    }
    let fails = 0;
    for (const child of this.getChildren()) {
      fails += child.node.getFails(child.quantity);
    }
    return fails + this.fails;
  }

  getNext(q = 1): { node: ItemNode; quantity: number } | null {
    if (this.isDone(q)) return null;
    if (this.isReady()) return { node: this, quantity: q };
    for (const child of this.getChildren()) {
      const res = child.node.getNext(child.quantity);
      if (res) return res;
    }
    return null;
  }

  async execute(quantity = 1): Promise<void> {
    if (!this.isReady()) {
      this.fails += 1;
      return;
    }
    const inventory = world.getInventoryCounts(this.manager.agent.bot);
    const init_quantity = inventory[this.name] || 0;
    if (this.type === "block") {
      await skills.collectBlock(
        this.manager.agent.bot,
        this.source!,
        quantity,
        this.manager.agent.npc.getBuiltPositions()
      );
    } else if (this.type === "smelt") {
      const to_smelt_name = this.recipe[0].node.name;
      const to_smelt_quantity = Math.min(
        quantity,
        inventory[to_smelt_name] || 1
      );
      await skills.smeltItem(
        this.manager.agent.bot,
        to_smelt_name,
        to_smelt_quantity
      );
    } else if (this.type === "hunt") {
      for (let i = 0; i < quantity; i++) {
        const res = await skills.attackNearest(
          this.manager.agent.bot,
          this.source!
        );
        if (!res || this.manager.agent.bot.interrupt_code) break;
      }
    } else if (this.type === "craft") {
      await skills.craftRecipe(this.manager.agent.bot, this.name, quantity);
    }
    const final_quantity =
      world.getInventoryCounts(this.manager.agent.bot)[this.name] || 0;
    if (final_quantity <= init_quantity) {
      this.fails += 1;
    }
  }
}

class ItemWrapper {
  manager: ItemGoal;
  name: string;
  parent: ItemWrapper | null;
  methods: ItemNode[];

  constructor(manager: ItemGoal, parent: ItemWrapper | null, name: string) {
    this.manager = manager;
    this.name = name;
    this.parent = parent;
    this.methods = [];

    let blacklisted = false;
    for (const match of blacklist) {
      if (name.includes(match)) {
        blacklisted = true;
        break;
      }
    }

    if (!blacklisted && !this.containsCircularDependency()) {
      this.createChildren();
    }
  }

  add_method(method: ItemNode): void {
    for (const child of method.getChildren()) {
      if (child.node.methods.length === 0) return;
    }
    this.methods.push(method);
  }

  createChildren(): void {
    const recipes = mc.getItemCraftingRecipes(this.name);
    if (recipes) {
      for (const recipe of recipes) {
        let includes_blacklisted = false;
        for (const ingredient in recipe) {
          for (const match of blacklist) {
            if (ingredient.includes(match)) {
              includes_blacklisted = true;
              break;
            }
          }
          if (includes_blacklisted) break;
        }
        if (includes_blacklisted) continue;
        this.add_method(
          new ItemNode(this.manager, this, this.name).setRecipe(recipe)
        );
      }
    }

    const block_sources = mc.getItemBlockSources(this.name);
    if (
      block_sources.length > 0 &&
      this.name !== "torch" &&
      !this.name.includes("bed")
    ) {
      // Do not collect placed torches or beds
      for (const block_source of block_sources) {
        if (block_source === "grass_block") continue; // Dirt nodes will collect grass blocks
        const tool = mc.getBlockTool(block_source);
        this.add_method(
          new ItemNode(this.manager, this, this.name).setCollectable(
            block_source,
            tool
          )
        );
      }
    }

    const smeltingIngredient = mc.getItemSmeltingIngredient(this.name);
    if (smeltingIngredient) {
      this.add_method(
        new ItemNode(this.manager, this, this.name).setSmeltable(
          smeltingIngredient
        )
      );
    }

    const animal_source = mc.getItemAnimalSource(this.name);
    if (animal_source) {
      this.add_method(
        new ItemNode(this.manager, this, this.name).setHuntable(animal_source)
      );
    }
  }

  containsCircularDependency(): boolean {
    let p = this.parent;
    while (p) {
      if (p.name === this.name) {
        return true;
      }
      p = p.parent;
    }
    return false;
  }

  getBestMethod(q = 1): ItemNode | null {
    let best_cost = -1;
    let best_method: ItemNode | null = null;
    for (const method of this.methods) {
      const cost = method.getDepth(q) + method.getFails(q);
      if (best_cost === -1 || cost < best_cost) {
        best_cost = cost;
        best_method = method;
      }
    }
    return best_method;
  }

  isDone(q = 1): boolean {
    if (this.methods.length === 0) return false;
    const bestMethod = this.getBestMethod(q);
    return bestMethod ? bestMethod.isDone(q) : false;
  }

  getDepth(q = 1): number {
    if (this.methods.length === 0) return 0;
    const bestMethod = this.getBestMethod(q);
    return bestMethod ? bestMethod.getDepth(q) : 0;
  }

  getFails(q = 1): number {
    if (this.methods.length === 0) return 0;
    const bestMethod = this.getBestMethod(q);
    return bestMethod ? bestMethod.getFails(q) : 0;
  }

  getNext(q = 1): { node: ItemNode; quantity: number } | null {
    if (this.methods.length === 0) return null;
    const bestMethod = this.getBestMethod(q);
    return bestMethod ? bestMethod.getNext(q) : null;
  }
}

export class ItemGoal {
  agent: Agent;
  goal: ItemWrapper | null;
  nodes: { [key: string]: ItemWrapper };
  failed: string[];

  constructor(agent: Agent) {
    this.agent = agent;
    this.goal = null;
    this.nodes = {};
    this.failed = [];
  }

  async executeNext(item_name: string, item_quantity = 1): Promise<boolean> {
    if (this.nodes[item_name] === undefined)
      this.nodes[item_name] = new ItemWrapper(this, null, item_name);
    this.goal = this.nodes[item_name];

    // Get next goal to execute
    const next_info = this.goal.getNext(item_quantity);
    if (!next_info) {
      console.log(`Invalid item goal ${this.goal.name}`);
      return false;
    }
    const next = next_info.node;
    const quantity = next_info.quantity;

    // Prevent unnecessary attempts to obtain blocks that are not nearby
    if (
      (next.type === "block" &&
        !world.getNearbyBlockTypes(this.agent.bot).includes(next.source!)) ||
      (next.type === "hunt" &&
        !world.getNearbyEntityTypes(this.agent.bot).includes(next.source!))
    ) {
      next.fails += 1;

      // If the bot has failed to obtain the block before, explore
      if (this.failed.includes(next.name)) {
        this.failed = this.failed.filter((item) => item !== next.name);
        await this.agent.coder.execute(async () => {
          await skills.moveAway(this.agent.bot, 8);
        });
      } else {
        this.failed.push(next.name);
        await new Promise((resolve) => setTimeout(resolve, 500));
        this.agent.bot.emit("idle");
      }
      return false;
    }

    // Wait for the bot to be idle before attempting to execute the next goal
    if (!this.agent.isIdle()) return false;

    // Execute the next goal
    const init_quantity =
      world.getInventoryCounts(this.agent.bot)[next.name] || 0;
    await this.agent.coder.execute(async () => {
      await next.execute(quantity);
    });
    const final_quantity =
      world.getInventoryCounts(this.agent.bot)[next.name] || 0;

    // Log the result of the goal attempt
    if (final_quantity > init_quantity) {
      console.log(
        `Successfully obtained ${next.name} for goal ${this.goal.name}`
      );
    } else {
      console.log(`Failed to obtain ${next.name} for goal ${this.goal.name}`);
    }
    return final_quantity > init_quantity;
  }
}
