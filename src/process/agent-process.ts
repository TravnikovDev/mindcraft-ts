import { spawn, ChildProcess } from "child_process";

export class AgentProcess {
  name!: string;
  start(
    profile: string,
    load_memory: boolean = false,
    init_message: string | null = null
  ): void {
    const args: string[] = ["src/process/init-agent.ts", this.name];
    args.push("-p", profile);
    if (load_memory) args.push("-l", String(load_memory));
    if (init_message) args.push("-m", init_message);

    const agentProcess: ChildProcess = spawn("bun", args, {
      stdio: "inherit",
    });

    let last_restart: number = Date.now();
    agentProcess.on(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null) => {
        console.log(
          `Agent process exited with code ${code} and signal ${signal}`
        );

        if (code !== 0) {
          if (Date.now() - last_restart < 10000) {
            console.error(
              "Agent process exited too quickly. Killing entire process. Goodbye."
            );
            process.exit(1);
          }
          console.log("Restarting agent...");
          this.start(profile, true, "Agent process restarted.");
          last_restart = Date.now();
        }
      }
    );

    agentProcess.on("error", (err: Error) => {
      console.error("Failed to start agent process:", err);
    });
  }
}
