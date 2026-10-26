import { exec } from "node:child_process";
import { createInterface } from "node:readline";
import { DEFAULT_PORT, login, redirectUri, type Credentials } from "../auth.js";
import { openTokenStore } from "../tokenstore.js";

/** Reads a line from the terminal; hidden input is not echoed. Secrets are never printed or logged. */
function prompt(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve) => {
    const rl: any = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stderr.write(s);
      };
    }
    rl.question(question, (answer: string) => {
      rl.close();
      if (hidden) process.stderr.write("\n");
      resolve(answer.trim());
    });
  });
}

async function credentials(): Promise<Credentials> {
  const clientId = process.env.LINKEDIN_CLIENT_ID || (await prompt("LinkedIn client ID: ", false));
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || (await prompt("LinkedIn client secret: ", true));
  if (!clientId || !clientSecret) throw new Error("Client ID and secret are required.");
  return { clientId, clientSecret };
}

function openUrl(url: string) {
  console.error(`Open this URL in your browser if it does not open automatically:\n${url}`);
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const port = Number(process.env.LINKEDIN_REDIRECT_PORT) || DEFAULT_PORT;
console.error(`Register this redirect URI in your LinkedIn app: ${redirectUri(port)}`);
const creds = await credentials();
const store = await openTokenStore();
await login({ creds, port, store, openUrl });
console.error(`Logged in. Token stored (${store.kind}).`);
