// src/agent/coder.ts

import { writeFile, readFile, mkdirSync } from "fs";
import settings from "../../settings";
import { Agent } from "./agent"; // Assuming Agent interface or class is defined
import { History } from "./history"; // Assuming History class is defined
import { ExtendedBot } from "../types";

export class Coder {
  agent: Agent;
  file_counter: number;
  fp: string;
  executing: boolean;
  generating: boolean;
  code_template: string;
  timedout: boolean;
  cur_action_name: string;
  resume_func: (() => Promise<void>) | null;
  resume_name: string | null;

  constructor(agent: Agent) {
    this.agent = agent;
    this.file_counter = 0;
    this.fp = "/bots/" + agent.name + "/action-code/";
    this.executing = false;
    this.generating = false;
    this.code_template = "";
    this.timedout = false;
    this.cur_action_name = "";
    this.resume_func = null;
    this.resume_name = null;

    readFile("./bots/template.ts", "utf8", (err, data) => {
      if (err) throw err;
      this.code_template = data;
    });

    mkdirSync("." + this.fp, { recursive: true });
  }

  // write custom code to file and import it
  async stageCode(code: string): Promise<any> {
    code = this.sanitizeCode(code);
    let src = "";
    code = code.replace(/console\.log\(/g, "log(bot,");
    code = code.replace(/log\("/g, 'log(bot,"');

    console.log(`Generated code: """${code}"""`);

    // this may cause problems in callback functions
    code = code.replace(
      /;\n/g,
      '; if(bot.interrupt_code) {log(bot, "Code interrupted.");return;}\n'
    );
    for (let line of code.split("\n")) {
      src += `    ${line}\n`;
    }
    src = this.code_template.replace("/* CODE HERE */", src);

    const filename = `${this.file_counter}.js`;
    // if (this.file_counter > 0) {
    //     let prev_filename = this.fp + (this.file_counter-1) + '.js';
    //     unlink(prev_filename, (err) => {
    //         console.log("deleted file " + prev_filename);
    //         if (err) console.error(err);
    //     });
    // } commented for now, useful to keep files for debugging
    this.file_counter++;

    try {
      await this.writeFilePromise("." + this.fp + filename, src);
    } catch (err) {
      console.error("Error writing code execution file: " + err);
      return null;
    }
    return await import("../.." + this.fp + filename);
  }

  sanitizeCode(code: string): string {
    code = code.trim();
    const remove_strs = ["Javascript", "javascript", "js"];
    for (const r of remove_strs) {
      if (code.startsWith(r)) {
        code = code.slice(r.length);
        return code;
      }
    }
    return code;
  }

  writeFilePromise(filename: string, src: string): Promise<void> {
    // makes it so we can await this function
    return new Promise<void>((resolve, reject) => {
      writeFile(filename, src, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async generateCode(agent_history: History): Promise<string | null | void> {
    // wrapper to prevent overlapping code generation loops
    await this.stop();
    this.generating = true;
    const res = await this.generateCodeLoop(agent_history);
    this.generating = false;
    // @ts-ignore
    if (!res.interrupted) this.agent.bot.emit("idle");
    return res.message;
  }

  async generateCodeLoop(agent_history: History): Promise<{
    success: boolean;
    message: string | null;
    interrupted: boolean;
    timedout: boolean;
  }> {
    const messages = agent_history.getHistory();
    messages.push({
      role: "system",
      content:
        "Code generation started. Write code in codeblock in your response:",
    });

    let code: string | null = null;
    let code_return: {
      success: boolean;
      message: string;
      interrupted: boolean;
      timedout: boolean;
    } | null = null;
    let failures = 0;
    const interrupt_return = {
      success: true,
      message: null,
      interrupted: true,
      timedout: false,
    };
    for (let i = 0; i < 5; i++) {
      if ((this.agent.bot as ExtendedBot).interrupt_code)
        return interrupt_return;
      console.log(messages);
      const res = await this.agent.prompter.promptCoding(
        JSON.parse(JSON.stringify(messages))
      );
      if ((this.agent.bot as ExtendedBot).interrupt_code)
        return interrupt_return;
      const contains_code = res.indexOf("```") !== -1;
      if (!contains_code) {
        if (res.indexOf("!newAction") !== -1) {
          messages.push({
            role: "assistant",
            content: res.substring(0, res.indexOf("!newAction")),
          });
          continue; // using newaction will continue the loop
        }

        if (failures >= 1) {
          return {
            success: false,
            message: "Action failed, agent would not write code.",
            interrupted: false,
            timedout: false,
          };
        }
        messages.push({
          role: "system",
          content:
            "Error: no code provided. Write code in codeblock in your response. ``` // example ```",
        });
        failures++;
        continue;
      }
      code = res.substring(res.indexOf("```") + 3, res.lastIndexOf("```"));

      const execution_file = await this.stageCode(code);
      if (!execution_file) {
        agent_history.add(
          "system",
          "Failed to stage code, something is wrong."
        );
        return {
          success: false,
          message: null,
          interrupted: false,
          timedout: false,
        };
      }
      code_return = await this.execute(async () => {
        return await execution_file.main(this.agent.bot);
      }, settings.code_timeout_mins);

      if (code_return.interrupted && !code_return.timedout)
        return {
          success: false,
          message: null,
          interrupted: true,
          timedout: false,
        };
      console.log(
        "Code generation result:",
        code_return.success,
        code_return.message
      );

      if (code_return.success) {
        const summary =
          "Summary of newAction\nAgent wrote this code: \n```" +
          this.sanitizeCode(code) +
          "```\nCode Output:\n" +
          code_return.message;
        return {
          success: true,
          message: summary,
          interrupted: false,
          timedout: false,
        };
      }

      messages.push({
        role: "assistant",
        content: res,
      });
      messages.push({
        role: "system",
        content: code_return.message + "\nCode failed. Please try again:",
      });
    }
    return {
      success: false,
      message: null,
      interrupted: false,
      timedout: true,
    };
  }

  async executeResume(
    func: (() => Promise<void>) | null = null,
    timeout: number = 10
  ): Promise<{
    success: boolean;
    message: string | null;
    interrupted: boolean;
    timedout: boolean;
  }> {
    if (func != null) {
      // start new resume
      this.resume_func = func;
      this.resume_name = this.cur_action_name;
    }
    if (
      this.resume_func != null &&
      this.agent.isIdle() &&
      !this.agent.self_prompter.on
    ) {
      this.cur_action_name = this.resume_name!;
      const res = await this.execute(this.resume_func, timeout);
      this.cur_action_name = "";
      return res;
    } else {
      return {
        success: false,
        message: null,
        interrupted: false,
        timedout: false,
      };
    }
  }

  cancelResume(): void {
    this.resume_func = null;
    this.resume_name = null;
  }

  setCurActionName(name: string): void {
    this.cur_action_name = name.replace(/!/g, "");
  }

  // returns {success: bool, message: string, interrupted: bool, timedout: false}
  async execute(
    func: () => Promise<void>,
    timeout: number = 10
  ): Promise<{
    success: boolean;
    message: string;
    interrupted: boolean;
    timedout: boolean;
  }> {
    if (!this.code_template)
      return {
        success: false,
        message: "Code template not loaded.",
        interrupted: false,
        timedout: false,
      };

    let TIMEOUT: NodeJS.Timeout | undefined;
    try {
      console.log("executing code...\n");
      await this.stop();
      this.clear();

      this.executing = true;
      if (timeout > 0) TIMEOUT = this._startTimeout(timeout);
      await func(); // open fire
      this.executing = false;
      if (TIMEOUT) clearTimeout(TIMEOUT);

      const output = this.formatOutput(this.agent.bot as ExtendedBot);
      const interrupted =
        (this.agent.bot as ExtendedBot).interrupt_code || false;
      const timedout = this.timedout;
      this.clear();
      // @ts-ignore
      if (!interrupted && !this.generating) this.agent.bot.emit("idle");
      return { success: true, message: output, interrupted, timedout };
    } catch (err) {
      this.executing = false;
      if (TIMEOUT) clearTimeout(TIMEOUT);
      this.cancelResume();
      console.error("Code execution triggered catch: " + err);
      await this.stop();

      const message =
        this.formatOutput(this.agent.bot as ExtendedBot) +
        "!!Code threw exception!!  Error: " +
        err;
      const interrupted =
        (this.agent.bot as ExtendedBot).interrupt_code || false;
      this.clear();
      // @ts-ignore
      if (!interrupted && !this.generating) this.agent.bot.emit("idle");
      return { success: false, message, interrupted, timedout: false };
    }
  }

  formatOutput(bot: ExtendedBot): string {
    if (bot.interrupt_code && !this.timedout) return "";
    let output = bot.output;
    const MAX_OUT = 500;
    if (output && output.length > MAX_OUT) {
      output = `Code output is very long (${output.length} chars) and has been shortened.\nFirst outputs:\n${output.substring(
        0,
        MAX_OUT / 2
      )}\n...skipping many lines.\nFinal outputs:\n${output.substring(output.length - MAX_OUT / 2)}`;
    } else {
      output = "Code output:\n" + output;
    }
    return output;
  }

  async stop(): Promise<void> {
    if (!this.executing) return;
    const start = Date.now();
    while (this.executing) {
      (this.agent.bot as ExtendedBot).interrupt_code = true;
      (this.agent.bot as ExtendedBot).collectBlock.cancelTask();
      (this.agent.bot as ExtendedBot).pathfinder.stop();
      (this.agent.bot as ExtendedBot).pvp.stop();
      console.log("waiting for code to finish executing...");
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      if (Date.now() - start > 10 * 1000) {
        this.agent.cleanKill(
          "Code execution refused stop after 10 seconds. Killing process."
        );
      }
    }
  }

  clear(): void {
    (this.agent.bot as ExtendedBot).output = "";
    (this.agent.bot as ExtendedBot).interrupt_code = false;
    this.timedout = false;
  }

  _startTimeout(TIMEOUT_MINS: number = 10): NodeJS.Timeout {
    return setTimeout(
      async () => {
        console.warn(
          `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`
        );
        this.timedout = true;
        this.agent.history.add(
          "system",
          `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`
        );
        await this.stop(); // last attempt to stop
      },
      TIMEOUT_MINS * 60 * 1000
    );
  }
}
