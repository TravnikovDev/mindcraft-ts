// src/agent/commands/index.ts

import { actionsList } from "./actions";
import { queryList } from "./queries";
import { Agent } from "../agent"; // Assuming Agent interface is defined

interface Command {
  name: string;
  description: string;
  params?: { [key: string]: string };
  perform: (agent: Agent, ...args: any[]) => Promise<any>;
}

interface ParsedCommand {
  commandName: string;
  args: any[];
}

const commandList: Command[] = queryList.concat(actionsList);
const commandMap: { [name: string]: Command } = {};
for (const command of commandList) {
  commandMap[command.name] = command;
}

export function getCommand(name: string): Command | undefined {
  return commandMap[name];
}

const commandRegex = /!(\w+)(?:\(((?:[^)(]+|'[^']*'|"[^"]*")*)\))?/;
const argRegex = /(?:"[^"]*"|'[^']*'|[^,])+/g;

export function containsCommand(message: string): string | null {
  const commandMatch = message.match(commandRegex);
  if (commandMatch) return "!" + commandMatch[1];
  return null;
}

export function commandExists(commandName: string): boolean {
  if (!commandName.startsWith("!")) commandName = "!" + commandName;
  return commandMap[commandName] !== undefined;
}

// TODO: handle arrays?
function parseCommandMessage(message: string): ParsedCommand | null {
  const commandMatch = message.match(commandRegex);
  if (commandMatch) {
    const commandName = "!" + commandMatch[1];
    if (!commandMatch[2]) return { commandName, args: [] };
    let args: any[] = commandMatch[2].match(argRegex) as any[];
    if (args) {
      for (let i = 0; i < args.length; i++) {
        args[i] = args[i].trim();
      }

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (
          (arg.startsWith('"') && arg.endsWith('"')) ||
          (arg.startsWith("'") && arg.endsWith("'"))
        ) {
          args[i] = arg.substring(1, arg.length - 1);
        } else if (!isNaN(Number(arg))) {
          args[i] = Number(arg);
        } else if (arg === "true" || arg === "false") {
          args[i] = arg === "true";
        }
      }
    } else {
      args = [];
    }

    return { commandName, args };
  }
  return null;
}

export function truncCommandMessage(message: string): string {
  const commandMatch = message.match(commandRegex);
  if (commandMatch && commandMatch.index !== undefined) {
    return message.substring(0, commandMatch.index + commandMatch[0].length);
  }
  return message;
}

export function isAction(name: string): boolean {
  return actionsList.find((action) => action.name === name) !== undefined;
}

function numParams(command: Command): number {
  if (!command.params) return 0;
  return Object.keys(command.params).length;
}

export async function executeCommand(
  agent: Agent,
  message: string
): Promise<string> {
  const parsed = parseCommandMessage(message);
  if (parsed) {
    const command = getCommand(parsed.commandName);
    if (!command) {
      return `Command ${parsed.commandName} does not exist.`;
    }
    const is_action = isAction(command.name);
    const numArgs = parsed.args.length;

    console.log("parsed command:", parsed);
    if (numArgs !== numParams(command)) {
      return `Command ${command.name} was given ${numArgs} args, but requires ${numParams(
        command
      )} args.`;
    } else {
      if (is_action) agent.coder.setCurActionName(command.name);
      const result = await command.perform(agent, ...parsed.args);
      if (is_action) agent.coder.setCurActionName("");
      return result || "";
    }
  } else {
    return `Command is incorrectly formatted`;
  }
}

export function getCommandDocs(): string {
  let docs = `\n*COMMAND DOCS\n You can use the following commands to perform actions and get information about the world. 
Use the commands with the syntax: !commandName or !commandName("arg1", 1.2, ...) if the command takes arguments.\n
Do not use codeblocks. Only use one command in each response, trailing commands and comments will be ignored.\n`;
  for (const command of commandList) {
    docs += `${command.name}: ${command.description}\n`;
    if (command.params) {
      docs += "Params:\n";
      for (const param in command.params) {
        docs += `${param}: ${command.params[param]}\n`;
      }
    }
  }
  return docs + "*\n";
}
