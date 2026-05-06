/**
 * Dev wrapper:
 *  1. Starts serve.js IMMEDIATELY so the /status health check passes right away.
 *  2. Triggers `expo export --platform web` in the background.
 *  3. serve.js checks web-build dynamically per-request, so once the export
 *     finishes the browser automatically gets the real web app on next refresh.
 */

const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

// ── 1. Start serve.js immediately (handles /status health check) ──────────
const serveProc = spawn("node", ["server/serve.js"], {
  stdio: "inherit",
  cwd: projectRoot,
  env: process.env,
});

serveProc.on("exit", (code) => {
  process.exit(code ?? 0);
});

// ── 2. Build web app in background ────────────────────────────────────────
console.log("[Dev] Starting background web export (refresh browser when done)...");

const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_INTERNAL_APP_DOMAIN || "localhost";

const buildProc = spawn("node", ["scripts/build.js"], {
  stdio: "inherit",
  cwd: projectRoot,
  env: {
    ...process.env,
    EXPO_PUBLIC_DOMAIN: domain,
    EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || "",
  },
});

buildProc.on("exit", (code) => {
  if (code === 0) {
    console.log("[Dev] Web build complete — refresh /mobile/ to see the app.");
  } else {
    console.warn("[Dev] Web build failed — landing page is being served at /mobile/");
  }
});

// ── 3. Clean shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
  serveProc.kill(signal);
  if (!buildProc.exitCode && buildProc.exitCode !== 0) {
    buildProc.kill(signal);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
