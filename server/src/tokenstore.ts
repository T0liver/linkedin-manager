import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.js";

export interface StoredToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope?: string;
}

export interface TokenStore {
  readonly kind: "keychain" | "file";
  get(): StoredToken | undefined;
  set(token: StoredToken): void;
  delete(): void;
}

const SERVICE = "linkedin-agent";
const ACCOUNT = "default";

function parse(raw: string | null | undefined): StoredToken | undefined {
  if (!raw) return undefined;
  try {
    const t = JSON.parse(raw);
    if (typeof t.accessToken === "string" && typeof t.expiresAt === "number") return t;
  } catch {
    /* corrupt entry: treat as missing */
  }
  return undefined;
}

export interface KeyringEntry {
  getPassword(): string | null;
  setPassword(value: string): void;
  deletePassword(): boolean;
}

export class KeychainTokenStore implements TokenStore {
  readonly kind = "keychain" as const;
  constructor(private entry: KeyringEntry) {}
  get() {
    return parse(this.entry.getPassword());
  }
  set(token: StoredToken) {
    this.entry.setPassword(JSON.stringify(token));
  }
  delete() {
    this.entry.deletePassword();
  }
}

export class FileTokenStore implements TokenStore {
  readonly kind = "file" as const;
  private path: string;
  constructor(dir: string = dataDir()) {
    this.path = join(dir, "token.json");
  }
  get() {
    return existsSync(this.path) ? parse(readFileSync(this.path, "utf8")) : undefined;
  }
  set(token: StoredToken) {
    mkdirSync(join(this.path, ".."), { recursive: true });
    writeFileSync(this.path, JSON.stringify(token), { mode: 0o600 });
    chmodSync(this.path, 0o600);
  }
  delete() {
    rmSync(this.path, { force: true });
  }
}

/** Keychain when usable, otherwise a 0600 file in the data dir (with a warning). */
export async function openTokenStore(
  dir: string = dataDir(),
  warn: (msg: string) => void = (m) => console.error(m),
): Promise<TokenStore> {
  if (process.env.LINKEDIN_AGENT_NO_KEYCHAIN === "1") return new FileTokenStore(dir);
  try {
    const { Entry } = await import("@napi-rs/keyring");
    const store = new KeychainTokenStore(new Entry(SERVICE, ACCOUNT));
    store.get(); // probe: throws if no keychain backend is available
    return store;
  } catch {
    warn(`warning: OS keychain unavailable; storing the token in ${join(dir, "token.json")} (mode 0600).`);
    return new FileTokenStore(dir);
  }
}
