export interface Settings {
  minecraft_version: string;
  host: string;
  port: number;
  auth: "offline" | "microsoft";
  profiles: string[];
  load_memory: boolean;
  init_message: string;
  allow_insecure_coding: boolean;
  code_timeout_mins: number;
  max_commands: number;
  verbose_commands: boolean;
  narrate_behavior: boolean;
}

const settings: Settings = {
  minecraft_version: "1.20.4",
  host: "127.0.0.1",
  port: 55916,
  auth: "offline",
  profiles: [
    "./andy.json",
    // add more profiles here, check ./profiles/ for more
    // more than 1 profile will require you to /msg each bot indivually
  ],
  load_memory: false, // load memory from previous session
  init_message: "Say hello world and your name", // sends to all on spawn
  allow_insecure_coding: false, // allows newAction command and model can write/run code on your computer. enable at own risk
  code_timeout_mins: 10, // minutes code is allowed to run. -1 for no timeout
  max_commands: -1, // max number of commands to use in a response. -1 for no limit
  verbose_commands: true, // show full command syntax
  narrate_behavior: true, // chat simple automatic actions ('Picking up item!')
};

export default settings;
