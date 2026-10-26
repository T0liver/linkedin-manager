import { fileURLToPath } from "node:url";
import { dataDir } from "../paths.js";
import { openTokenStore } from "../tokenstore.js";
import { formatChecks, runChecks } from "../doctor.js";

const distEntry = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
const dir = dataDir();
const store = await openTokenStore(dir, () => {});
const stored = store.get();

const checks = runChecks({
  nodeVersion: process.version,
  distEntry,
  dataDir: dir,
  token: stored && { kind: store.kind, expiresAt: stored.expiresAt },
  now: Date.now(),
});
console.log(formatChecks(checks));
process.exit(checks.some((c) => c.level === "fail") ? 1 : 0);
