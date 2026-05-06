/**
 * Standalone production server for Expo static builds.
 *
 * Routes:
 * - GET /status             → 200 OK health check (required by artifact.toml)
 * - GET / (expo-platform)   → iOS/Android manifest JSON for Expo Go
 * - GET /manifest (expo-platform) → same
 * - Everything else         → web-build SPA (index.html fallback), then static-build, then landing page
 *
 * Zero external dependencies — Node.js built-ins only.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.resolve(PROJECT_ROOT, "static-build");
const WEB_BUILD_ROOT = path.resolve(PROJECT_ROOT, "web-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

function getAppName() {
  try {
    const appJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "app.json"), "utf-8"));
    return appJson.expo?.name || "SayNow Pro";
  } catch {
    return "SayNow Pro";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveWebBuild(pathname, req, res, landingPageTemplate, appName) {
  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");

  // Try exact file first
  let filePath = path.join(WEB_BUILD_ROOT, safePath);
  if (!filePath.startsWith(WEB_BUILD_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(fs.readFileSync(filePath));
    return;
  }

  // SPA fallback: serve index.html for all non-asset paths
  const indexPath = path.join(WEB_BUILD_ROOT, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  // Fall through to landing page if no web build
  serveLandingPage(req, res, landingPageTemplate, appName);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = host;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticBundleFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": contentType });
  res.end(fs.readFileSync(filePath));
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

// Checked dynamically per-request so the dev background build is picked up
// automatically without restarting the server.
function checkWebBuild() {
  return fs.existsSync(path.join(WEB_BUILD_ROOT, "index.html"));
}

console.log(`Web build available: ${checkWebBuild()}`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Strip base path prefix
  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }
  if (!pathname.startsWith("/")) pathname = "/" + pathname;

  // Health check — required by artifact.toml ensurePreviewReachable
  if (pathname === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", webBuild: checkWebBuild() }));
    return;
  }

  // Expo Go native manifest requests
  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }
  }

  // Browser requests: serve web build (SPA) or landing page
  if (checkWebBuild()) {
    return serveWebBuild(pathname, req, res, landingPageTemplate, appName);
  }

  // Static bundle assets (iOS/Android bundles)
  if (pathname !== "/") {
    return serveStaticBundleFile(pathname, res);
  }

  // Fallback: landing page (Expo Go QR code)
  serveLandingPage(req, res, landingPageTemplate, appName);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`SayNow Pro Mobile server on port ${port} (basePath: "${basePath}")`);
  const hasBuild = checkWebBuild();
  console.log(`Web build: ${hasBuild ? "YES — serving React web app" : "NO — will build in background"}`);

  // In dev mode, kick off a background web export if no build exists yet.
  if (!hasBuild && process.env.NODE_ENV !== "production") {
    console.log("[Server] Starting background web export...");
    const buildProc = spawn("node", ["scripts/build.js"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
    });
    buildProc.on("exit", (code) => {
      if (code === 0) {
        console.log("[Server] Web build complete — serving React app on next request.");
      } else {
        console.warn(`[Server] Web build exited with code ${code} — landing page remains active.`);
      }
    });
    buildProc.on("error", (err) => {
      console.warn("[Server] Could not start build process:", err.message);
    });
  }
});
