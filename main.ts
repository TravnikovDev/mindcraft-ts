import { AgentProcess } from "./src/process/agent-process.js";
import settings from "./settings.js";

const profiles: string[] = settings.profiles;
const load_memory: boolean = settings.load_memory;
const init_message: string = settings.init_message;

for (const profile of profiles) {
  new AgentProcess().start(profile, load_memory, init_message);
}
