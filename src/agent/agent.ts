// src/agent/agent.ts

import { History } from "./history";
import { Coder } from "./coder";
import { Prompter } from "./prompter";
import { initModes } from "./modes";
import { initBot } from "../utils/mcdata";
import {
  containsCommand,
  commandExists,
  executeCommand,
  truncCommandMessage,
  isAction,
} from "./commands/index";
import { NPCController } from "./npc/controller";
import { MemoryBank } from "./memory_bank";
import { SelfPrompter } from "./self_prompter";
import settings from "../../settings";
import { ExtendedBot } from "../types";

export class Agent {
  prompter!: Prompter;
  name!: string;
  history!: History;
  coder!: Coder;
  npc!: NPCController;
  memory_bank!: MemoryBank;
  self_prompter!: SelfPrompter;
  bot!: ExtendedBot;
  shut_up: boolean = false;

  async start(
    profile_fp: string,
    load_mem: boolean = false,
    init_message: string | null = null
  ): Promise<void> {
    this.prompter = new Prompter(this, profile_fp);
    this.name = this.prompter.getName();
    this.history = new History(this);
    this.coder = new Coder(this);
    this.npc = new NPCController(this);
    this.memory_bank = new MemoryBank();
    this.self_prompter = new SelfPrompter(this);

    await this.prompter.initExamples();

    console.log("Logging in...");
    this.bot = initBot(this.name) as ExtendedBot;

    initModes(this);

    let save_data: any = null;
    if (load_mem) {
      save_data = this.history.load();
    }

    this.bot.once("spawn", async () => {
      // wait for a bit so stats are not undefined
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      console.log(`${this.name} spawned.`);
      this.coder.clear();

      const ignore_messages = [
        "Set own game mode to",
        "Set the time to",
        "Set the difficulty to",
        "Teleported ",
        "Set the weather to",
        "Gamerule ",
      ];
      const eventname = settings.profiles.length > 1 ? "whisper" : "chat";
      this.bot.on(eventname, (username: string, message: string) => {
        if (username === this.name) return;

        if (ignore_messages.some((m) => message.startsWith(m))) return;

        console.log("received message from", username, ":", message);

        this.shut_up = false;

        this.handleMessage(username, message);
      });

      // set the bot to automatically eat food when hungry
      this.bot.autoEat.options = {
        priority: "foodPoints",
        startAt: 14,
        bannedFood: [
          "rotten_flesh",
          "spider_eye",
          "poisonous_potato",
          "pufferfish",
          "chicken",
        ],
        eatingTimeout: 3000,
        ignoreInventoryCheck: false,
        checkOnItemPickup: true,
        offhand: false,
        equipOldItem: true,
      };

      if (save_data && save_data.self_prompt) {
        let prompt = save_data.self_prompt as string;
        // add initial message to history
        this.history.add("system", prompt);
        this.self_prompter.start(prompt);
      } else if (init_message) {
        this.handleMessage("system", init_message, 2);
      } else {
        this.bot.chat("Hello world! I am " + this.name);
        (this.bot as any).emit("finished_executing");
      }

      this.startEvents();
    });
  }

  cleanChat(message: string): void {
    // newlines are interpreted as separate chats, which triggers spam filters. replace them with spaces
    message = message.replace(/\n/g, "  ");
    this.bot.chat(message);
  }

  shutUp(): void {
    this.shut_up = true;
    if (this.self_prompter.on) {
      this.self_prompter.stop(false);
    }
  }

  async handleMessage(
    source: string,
    message: string,
    max_responses: number | null = null
  ): Promise<boolean> {
    let used_command = false;
    if (max_responses === null) {
      max_responses =
        settings.max_commands === -1 ? Infinity : settings.max_commands;
    }

    let self_prompt = source === "system" || source === this.name;

    if (!self_prompt) {
      const user_command_name = containsCommand(message);
      if (user_command_name) {
        if (!commandExists(user_command_name)) {
          this.bot.chat(`Command '${user_command_name}' does not exist.`);
          return false;
        }
        this.bot.chat(`*${source} used ${user_command_name.substring(1)}*`);
        if (user_command_name === "!newAction") {
          // all user-initiated commands are ignored by the bot except for this one
          // add the preceding message to the history to give context for newAction
          this.history.add(source, message);
        }
        const execute_res = await executeCommand(this, message);
        if (execute_res) this.cleanChat(execute_res);
        return true;
      }
    }

    const checkInterrupt = (): boolean =>
      this.self_prompter.shouldInterrupt(self_prompt) || this.shut_up;

    let behavior_log = this.bot.modes.flushBehaviorLog();
    if (behavior_log.trim().length > 0) {
      const MAX_LOG = 500;
      if (behavior_log.length > MAX_LOG) {
        behavior_log =
          "..." + behavior_log.substring(behavior_log.length - MAX_LOG);
      }
      behavior_log =
        "Recent behaviors log: \n" +
        behavior_log.substring(behavior_log.indexOf("\n"));
      await this.history.add("system", behavior_log);
    }

    await this.history.add(source, message);
    this.history.save();

    if (!self_prompt && this.self_prompter.on) max_responses = 1; // force only respond to this message, then let self-prompting take over

    for (let i = 0; i < max_responses; i++) {
      if (checkInterrupt()) break;
      const history = this.history.getHistory();
      const res = await this.prompter.promptConvo(history);

      const command_name = containsCommand(res);

      if (command_name) {
        console.log(`Full response: ""${res}""`);
        const truncatedRes = truncCommandMessage(res); // everything after the command is ignored
        this.history.add(this.name, truncatedRes);
        if (!commandExists(command_name)) {
          this.history.add("system", `Command ${command_name} does not exist.`);
          console.warn("Agent hallucinated command:", command_name);
          continue;
        }
        if (command_name === "!stopSelfPrompt" && self_prompt) {
          this.history.add(
            "system",
            `Cannot stopSelfPrompt unless requested by user.`
          );
          continue;
        }

        if (checkInterrupt()) break;
        this.self_prompter.handleUserPromptedCmd(
          self_prompt,
          isAction(command_name)
        );

        if (settings.verbose_commands) {
          this.cleanChat(truncatedRes);
        } else {
          const pre_message = truncatedRes
            .substring(0, truncatedRes.indexOf(command_name))
            .trim();
          let chat_message = `*used ${command_name.substring(1)}*`;
          if (pre_message.length > 0)
            chat_message = `${pre_message}  ${chat_message}`;
          this.cleanChat(chat_message);
        }

        const execute_res = await executeCommand(this, truncatedRes);

        console.log("Agent executed:", command_name, "and got:", execute_res);
        used_command = true;

        if (execute_res) this.history.add("system", execute_res);
        else break;
      } else {
        // conversation response
        this.history.add(this.name, res);
        this.cleanChat(res);
        console.log("Purely conversational response:", res);
        break;
      }
      this.history.save();
    }

    this.bot.emit("finished_executing");
    return used_command;
  }

  startEvents(): void {
    // Custom events
    this.bot.on("time", () => {
      if (this.bot.time.timeOfDay === 0) this.bot.emit("sunrise");
      else if (this.bot.time.timeOfDay === 6000) this.bot.emit("noon");
      else if (this.bot.time.timeOfDay === 12000) this.bot.emit("sunset");
      else if (this.bot.time.timeOfDay === 18000) this.bot.emit("midnight");
    });

    let prev_health = this.bot.health;
    (this.bot as any).lastDamageTime = 0;
    (this.bot as any).lastDamageTaken = 0;
    this.bot.on("health", () => {
      if (this.bot.health < prev_health) {
        (this.bot as any).lastDamageTime = Date.now();
        (this.bot as any).lastDamageTaken = prev_health - this.bot.health;
      }
      prev_health = this.bot.health;
    });
    // Logging callbacks
    this.bot.on("error", (err: Error) => {
      console.error("Error event!", err);
    });
    this.bot.on("end", (reason: string) => {
      console.warn("Bot disconnected! Killing agent process.", reason);
      this.cleanKill("Bot disconnected! Killing agent process.");
    });
    this.bot.on("death", () => {
      this.coder.cancelResume();
      this.coder.stop();
    });
    this.bot.on("kicked", (reason: string) => {
      console.warn("Bot kicked!", reason);
      this.cleanKill("Bot kicked! Killing agent process.");
    });
    this.bot.on("messagestr", async (message: string, _: any, jsonMsg: any) => {
      if (
        jsonMsg.translate &&
        jsonMsg.translate.startsWith("death") &&
        message.startsWith(this.name)
      ) {
        console.log("Agent died: ", message);
        await this.handleMessage(
          "system",
          `You died with the final message: '${message}'. Previous actions were stopped and you have respawned. Notify the user and perform any necessary actions.`
        );
      }
    });
    (this.bot as any).on("idle", () => {
      this.bot.clearControlStates();
      this.bot.pathfinder.stop(); // clear any lingering pathfinder
      this.bot.modes.unPauseAll();
      this.coder.executeResume();
    });

    // Init NPC controller
    this.npc.init();

    // Main update loop
    // This update loop ensures that each update() is called one at a time, even if it takes longer than the interval
    const INTERVAL = 300;
    let last = Date.now();
    setTimeout(async () => {
      while (true) {
        const start = Date.now();
        await this.update(start - last);
        const remaining = INTERVAL - (Date.now() - start);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }
        last = start;
      }
    }, INTERVAL);

    this.bot.emit("idle");
  }

  async update(delta: number): Promise<void> {
    // Update modes
    await this.bot.modes.update();

    // Update self-prompter
    await this.self_prompter.update(delta);

    // Check if bot is idle
    console.log("Bot is idle:", this.isIdle());
    if (this.isIdle()) {
      // If idle, initiate self-prompting with a default goal
      if (!this.self_prompter.on) {
        const defaultGoal =
          "Act for your own survival. Collect resources, upgrade tools, build shelter, and explore the world.";
        this.self_prompter.start(defaultGoal);
        console.log(
          "Bot is idle. Starting self-prompting with goal:",
          defaultGoal
        );
      }
    }
  }

  isIdle(): boolean {
    return (
      !this.coder.executing &&
      !this.coder.generating &&
      !this.bot.pathfinder.isMoving() &&
      !this.bot.pathfinder.isMining() &&
      !this.bot.pathfinder.isBuilding()
    );
  }

  cleanKill(msg: string = "Killing agent process..."): void {
    this.history.add("system", msg);
    this.bot.chat("Goodbye world.");
    this.history.save();
    process.exit(1);
  }
}
