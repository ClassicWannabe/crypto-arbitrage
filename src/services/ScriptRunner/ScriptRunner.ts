import { Monitor } from "forever-monitor";

import { Script, ScriptStatus } from "./types.js";
import { SCRIPT_PATHS } from "./consts.js";
import { logger } from "../../logger/logger.js";

export class ScriptRunner {
  private scriptStatus: ScriptStatus;
  private readonly script: Monitor;
  private readonly scriptType: Script;

  constructor(scriptType: Script) {
    const scriptPath = SCRIPT_PATHS[scriptType];
    this.scriptType = scriptType;

    this.script = new Monitor(scriptPath);
    this.script.start();
    this.scriptStatus = ScriptStatus.RUNNING;
  }

  start() {
    if (this.scriptStatus === ScriptStatus.RUNNING) {
      logger.warn("Already running the script:" + this.scriptType);
      return;
    }
    this.script.start();
    this.scriptStatus = ScriptStatus.RUNNING;
  }

  stop() {
    if (this.scriptStatus === ScriptStatus.STOPPED) {
      logger.warn("Already stopped the script:" + this.scriptType);
      return;
    }
    this.script.stop();
    this.scriptStatus = ScriptStatus.STOPPED;
  }
}
