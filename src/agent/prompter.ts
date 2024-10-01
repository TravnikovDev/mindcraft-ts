import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { Examples } from "../utils/examples.js";
import { getCommandDocs } from "./commands/index.js";
import { getSkillDocs } from "./library/index.js";
import { stringifyTurns } from "../utils/text.js";
import { getCommand } from "./commands/index.js";

import { GPT } from "../models/gpt.js";

interface Agent {
  name: string;
  self_prompter: {
    on: boolean;
    prompt: string;
  };
  npc: {
    constructions: Record<string, any>;
  };
  // Other properties and methods as needed
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Goal {
  name: string;
  quantity: number;
}

interface Profile {
  name: string;
  model: string | { model: string; api?: string; url?: string };
  embedding?: string | { api: string; model?: string; url?: string };
  modes?: any;
  conversing: string;
  coding: string;
  saving_memory: string;
  goal_setting: string;
  conversation_examples: any[];
  coding_examples: any[];
}

export class Prompter {
  private agent: Agent;
  private profile: Profile;
  private convo_examples: Examples | null;
  private coding_examples: Examples | null;
  private chat_model: GPT;
  private embedding_model: GPT | null;

  constructor(agent: Agent, fp: string) {
    this.agent = agent;
    this.profile = JSON.parse(readFileSync(fp, "utf8"));
    this.convo_examples = null;
    this.coding_examples = null;

    const name: string = this.profile.name;
    let chat = this.profile.model;

    if (typeof chat === "string" || chat instanceof String) {
      chat = { model: chat };
      if (chat.model.includes("gpt")) chat.api = "openai";
      else chat.api = "unknown"; // Adjusted since we only have GPT
    }

    console.log("Using chat settings:", chat);

    if (chat.api === "openai") this.chat_model = new GPT(chat.model, chat.url);
    else throw new Error("Unknown API: " + chat.api);

    let embedding = this.profile.embedding;
    if (embedding === undefined) {
      embedding = { api: chat.api };
    } else if (typeof embedding === "string" || embedding instanceof String) {
      embedding = { api: embedding };
    }

    console.log("Using embedding settings:", embedding);

    if (embedding.api === "openai")
      this.embedding_model = new GPT(embedding.model, embedding.url);
    else {
      this.embedding_model = null;
      console.log(
        "Unknown embedding:",
        embedding ? embedding.api : "[NOT SPECIFIED]",
        ". Using word overlap."
      );
    }

    mkdirSync(`./bots/${name}`, { recursive: true });
    writeFileSync(
      `./bots/${name}/last_profile.json`,
      JSON.stringify(this.profile, null, 4)
    );
  }

  getName(): string {
    return this.profile.name;
  }

  getInitModes(): any {
    return this.profile.modes;
  }

  async initExamples(): Promise<void> {
    // Using Promise.all to implement concurrent processing
    // Create Examples instances
    this.convo_examples = new Examples(this.embedding_model);
    this.coding_examples = new Examples(this.embedding_model);
    // Use Promise.all to load examples concurrently
    await Promise.all([
      this.convo_examples.load(this.profile.conversation_examples),
      this.coding_examples.load(this.profile.coding_examples),
    ]);
  }

  async replaceStrings(
    prompt: string,
    messages: Message[],
    examples: Examples | null = null,
    prev_memory: string | null = null,
    to_summarize: Message[] = [],
    last_goals: Record<string, boolean> = {}
  ): Promise<string> {
    prompt = prompt.replaceAll("$NAME", this.agent.name);

    if (prompt.includes("$STATS")) {
      const stats = await getCommand("!stats").perform(this.agent);
      prompt = prompt.replaceAll("$STATS", stats);
    }
    if (prompt.includes("$INVENTORY")) {
      const inventory = await getCommand("!inventory").perform(this.agent);
      prompt = prompt.replaceAll("$INVENTORY", inventory);
    }
    if (prompt.includes("$COMMAND_DOCS"))
      prompt = prompt.replaceAll("$COMMAND_DOCS", getCommandDocs());
    if (prompt.includes("$CODE_DOCS"))
      prompt = prompt.replaceAll("$CODE_DOCS", getSkillDocs());
    if (prompt.includes("$EXAMPLES") && examples !== null)
      prompt = prompt.replaceAll(
        "$EXAMPLES",
        await examples.createExampleMessage(messages)
      );
    if (prompt.includes("$MEMORY"))
      prompt = prompt.replaceAll(
        "$MEMORY",
        prev_memory ? prev_memory : "None."
      );
    if (prompt.includes("$TO_SUMMARIZE"))
      prompt = prompt.replaceAll("$TO_SUMMARIZE", stringifyTurns(to_summarize));
    if (prompt.includes("$CONVO"))
      prompt = prompt.replaceAll(
        "$CONVO",
        "Recent conversation:\n" + stringifyTurns(messages)
      );
    if (prompt.includes("$SELF_PROMPT")) {
      const self_prompt = this.agent.self_prompter.on
        ? `Use this self-prompt to guide your behavior: "${this.agent.self_prompter.prompt}"\n`
        : "";
      prompt = prompt.replaceAll("$SELF_PROMPT", self_prompt);
    }
    if (prompt.includes("$LAST_GOALS")) {
      let goal_text = "";
      for (const goal in last_goals) {
        if (last_goals[goal])
          goal_text += `You recently successfully completed the goal ${goal}.\n`;
        else goal_text += `You recently failed to complete the goal ${goal}.\n`;
      }
      prompt = prompt.replaceAll("$LAST_GOALS", goal_text.trim());
    }
    if (prompt.includes("$BLUEPRINTS")) {
      if (this.agent.npc.constructions) {
        let blueprints = "";
        for (const blueprint in this.agent.npc.constructions) {
          blueprints += blueprint + ", ";
        }
        prompt = prompt.replaceAll("$BLUEPRINTS", blueprints.slice(0, -2));
      }
    }

    // Check if there are any remaining placeholders with syntax $<word>
    const remaining = prompt.match(/\$[A-Z_]+/g);
    if (remaining !== null) {
      console.warn("Unknown prompt placeholders:", remaining.join(", "));
    }
    return prompt;
  }

  async promptConvo(messages: Message[]): Promise<string> {
    let prompt = this.profile.conversing;
    prompt = await this.replaceStrings(prompt, messages, this.convo_examples);
    return await this.chat_model.sendRequest(messages, prompt);
  }

  async promptCoding(messages: Message[]): Promise<string> {
    let prompt = this.profile.coding;
    prompt = await this.replaceStrings(prompt, messages, this.coding_examples);
    return await this.chat_model.sendRequest(messages, prompt);
  }

  async promptMemSaving(
    prev_mem: string,
    to_summarize: Message[]
  ): Promise<string> {
    let prompt = this.profile.saving_memory;
    prompt = await this.replaceStrings(
      prompt,
      [],
      null,
      prev_mem,
      to_summarize
    );
    return await this.chat_model.sendRequest([], prompt);
  }

  async promptGoalSetting(
    messages: Message[],
    last_goals: Record<string, boolean>
  ): Promise<Goal | null> {
    let system_message = this.profile.goal_setting;
    system_message = await this.replaceStrings(system_message, messages);

    let user_message =
      "Use the below info to determine what goal to target next\n\n";
    user_message += "$LAST_GOALS\n$STATS\n$INVENTORY\n$CONVO";
    user_message = await this.replaceStrings(
      user_message,
      messages,
      null,
      null,
      [],
      last_goals
    );
    const user_messages: Message[] = [{ role: "user", content: user_message }];

    const res = await this.chat_model.sendRequest(
      user_messages,
      system_message
    );

    let goal: Goal | null = null;
    try {
      const data = res.split("```")[1].replace("json", "").trim();
      goal = JSON.parse(data);
    } catch (err) {
      console.log("Failed to parse goal:", res, err);
    }
    if (
      !goal ||
      !goal.name ||
      !goal.quantity ||
      isNaN(parseInt(goal.quantity.toString()))
    ) {
      console.log("Failed to set goal:", res);
      return null;
    }
    goal.quantity = parseInt(goal.quantity.toString());
    return goal;
  }
}
