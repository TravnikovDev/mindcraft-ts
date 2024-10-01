import { Agent } from "../agent/agent.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface Argv {
  profile?: string;
  load_memory?: boolean;
  init_message?: string;
}

const args: string[] = process.argv.slice(2);

if (args.length < 1) {
  console.log(
    "Usage: bun init-agent.ts <agent_name> [--profile] [--load_memory] [--init_message]"
  );
  process.exit(1);
}

const argv: Argv = yargs(hideBin(process.argv))
  .option("profile", {
    alias: "p",
    type: "string",
    description: "Profile filepath to use for agent",
  })
  .option("load_memory", {
    alias: "l",
    type: "boolean",
    description: "Load agent memory from file on startup",
  })
  .option("init_message", {
    alias: "m",
    type: "string",
    description: "Automatically prompt the agent on startup",
  }).argv as Argv;

new Agent().start(argv.profile, argv.load_memory, argv.init_message);
