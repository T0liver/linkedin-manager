import { whoami as authWhoami, type WhoAmI } from "../auth.js";
import type { TokenStore } from "../tokenstore.js";

export function whoami(store: TokenStore): Promise<WhoAmI> {
  return authWhoami(store);
}
