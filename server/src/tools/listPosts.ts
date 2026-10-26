import { dataDir } from "../paths.js";
import { readLog, type LogEntry } from "../postlog.js";

/** Local only: reads post-log.md, never calls LinkedIn. Newest first. */
export function listPosts(limit = 20, dir: string = dataDir()): { posts: LogEntry[]; warnings: string[] } {
  const { entries, warnings } = readLog(dir);
  return { posts: entries.slice().reverse().slice(0, limit), warnings };
}
