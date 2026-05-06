/**
 * Production build: runs `expo export --platform web` → web-build/
 * Serves via server/serve.js after this completes.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");
const webBuildDir = path.join(projectRoot, "web-build");

function getDeploymentDomain() {
  const domain =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    console.warn("WARNING: No deployment domain found — using fallback saynow-pro.replit.app");
    return "saynow-pro.replit.app";
  }
  let url = domain.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return new URL(url).host;
}

async function main() {
  console.log("=== SayNow Pro Mobile — web export build ===");

  if (fs.existsSync(webBuildDir)) {
    console.log("Cleaning previous web-build...");
    fs.rmSync(webBuildDir, { recursive: true });
  }

  const domain = getDeploymentDomain();
  const replId = process.env.REPL_ID || process.env.EXPO_PUBLIC_REPL_ID || "";
  console.log(`Building for domain: ${domain}`);

  await new Promise((resolve, reject) => {
    const proc = spawn(
      "pnpm",
      ["exec", "expo", "export", "--platform", "web", "--output-dir", webBuildDir],
      {
        stdio: "inherit",
        cwd: projectRoot,
        env: {
          ...process.env,
          EXPO_PUBLIC_DOMAIN: domain,
          EXPO_PUBLIC_REPL_ID: replId,
        },
      }
    );

    proc.on("exit", (code) => {
      if (code === 0) {
        console.log(`Web export complete → ${webBuildDir}`);
        resolve();
      } else {
        reject(new Error(`expo export exited with code ${code}`));
      }
    });

    proc.on("error", reject);
  });

  console.log("Build complete!");
}

main().catch((err) => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
