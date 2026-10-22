import { homedir } from "node:os";
import { join } from "node:path";

/** User data directory; `LINKEDIN_AGENT_HOME` overrides it (used in tests). */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.LINKEDIN_AGENT_HOME || join(homedir(), ".linkedin-agent");
}
