import { logout } from "../auth.js";
import { openTokenStore } from "../tokenstore.js";

logout(await openTokenStore());
console.error("Logged out. Stored token removed.");
