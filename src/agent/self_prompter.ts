import { Agent } from "./agent"; // Adjust the import path as necessary

export class SelfPrompter {
  private agent: Agent;
  private on: boolean;
  private loop_active: boolean;
  private interrupt: boolean;
  private prompt: string;
  private idle_time: number;
  private cooldown: number;

  constructor(agent: Agent) {
    this.agent = agent;
    this.on = false;
    this.loop_active = false;
    this.interrupt = false;
    this.prompt = "";
    this.idle_time = 0;
    this.cooldown = 2000;
  }

  start(prompt: string): void | string {
    console.log("Self-prompting started.");
    if (!prompt) {
      return "No prompt specified. Ignoring request.";
    }
    if (this.on) {
      this.prompt = prompt;
    }
    this.on = true;
    this.prompt = prompt;
    this.startLoop();
  }

  async startLoop(): Promise<void> {
    if (this.loop_active) {
      console.warn("Self-prompt loop is already active. Ignoring request.");
      return;
    }
    console.log("Starting self-prompt loop");
    this.loop_active = true;
    let no_command_count = 0;
    const MAX_NO_COMMAND = 3;
    while (!this.interrupt) {
      const msg = `You are self-prompting with the goal: '${this.prompt}'. Your next response MUST contain a command !withThisSyntax. Respond:`;

      const used_command = await this.agent.handleMessage("system", msg, 1);
      if (!used_command) {
        no_command_count++;
        if (no_command_count >= MAX_NO_COMMAND) {
          const out = `Agent did not use command in the last ${MAX_NO_COMMAND} auto-prompts. Stopping auto-prompting.`;
          this.agent.bot.chat(out);
          console.warn(out);
          this.on = false;
          break;
        }
      } else {
        no_command_count = 0;
        await new Promise((r) => setTimeout(r, this.cooldown));
      }
    }
    console.log("Self-prompt loop stopped");
    this.loop_active = false;
    this.interrupt = false;
  }

  update(delta: number): void {
    // Automatically restarts loop
    if (this.on && !this.loop_active && !this.interrupt) {
      if (this.agent.isIdle()) this.idle_time += delta;
      else this.idle_time = 0;

      if (this.idle_time >= this.cooldown) {
        console.log("Restarting self-prompting...");
        this.startLoop();
        this.idle_time = 0;
      }
    }
  }

  async stopLoop(): Promise<void> {
    // You can call this without await if you don't need to wait for it to finish
    console.log("Stopping self-prompt loop");
    this.interrupt = true;
    while (this.loop_active) {
      await new Promise((r) => setTimeout(r, 500));
    }
    this.interrupt = false;
  }

  async stop(stop_action = true): Promise<void> {
    this.interrupt = true;
    if (stop_action) await this.agent.coder.stop();
    await this.stopLoop();
    this.on = false;
  }

  shouldInterrupt(is_self_prompt: boolean): boolean {
    // To be called from handleMessage
    return is_self_prompt && this.on && this.interrupt;
  }

  handleUserPromptedCmd(is_self_prompt: boolean, is_action: boolean): void {
    // If a user messages and the bot responds with an action, stop the self-prompt loop
    if (!is_self_prompt && is_action) {
      this.stopLoop();
      // This stops it from responding from the handleMessage loop and the self-prompt loop at the same time
    }
  }
}
