#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const requireClean = process.argv.includes("--require-clean");

function main() {
  console.log("Mini Program release check\n");

  checkWorktree();
  runStep("Mini Program preflight", "npm", ["run", "mini:preflight"]);
  runStep("H5 build for retained filing route", "npm", ["run", "demo:build"]);
  printReleaseSummary();
}

function checkWorktree() {
  const status = gitStatus();

  if (!status) {
    console.log("PASS Git worktree is clean.");
    return;
  }

  if (requireClean) {
    console.error("FAIL Git worktree must be clean before release:");
    console.error(status);
    process.exit(1);
  }

  console.log("WARN Git worktree has local changes:");
  console.log(status);
  console.log("Run with --require-clean before uploading an experience version.\n");
}

function runStep(label, command, args) {
  console.log(`\n== ${label} ==`);
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });
}

function printReleaseSummary() {
  const projectConfig = readJson("miniprogram/project.config.json");
  const config = require(path.join(miniprogramRoot, "config"));
  const packageSize = directorySize(miniprogramRoot, (file) =>
    !file.endsWith("project.private.config.json"),
  );

  console.log("\n== Release summary ==");
  console.log(`AppID: ${projectConfig.appid}`);
  console.log(`Request legal domain: ${config.REQUEST_DOMAIN}`);
  console.log(`Web-view business domain: ${config.WEBVIEW_DOMAIN}`);
  console.log(`LLM endpoint: ${config.API_URL}`);
  console.log(`Mini Program source package: ${formatBytes(packageSize)}`);

  console.log("\nManual gates still required before review/upload:");
  [
    "Scan a fresh preview QR on a phone and run the Phone QA checklist.",
    "Confirm https://api.tanxj.xyz is accepted as a WeChat request legal domain.",
    "Confirm https://www.tanxj.xyz is accepted as a web-view business domain, if keeping the H5 route in review.",
    "Run the settings page backend connectivity test with the access key saved locally.",
    "Copy diagnostics from the settings page if the backend connectivity test fails.",
    "Generate one native LLM report with the backend access key saved locally.",
    "Confirm the native LLM report restores for the same birth profile and can be cleared locally.",
    "Upload only with npm run mini:upload -- --version <version> --desc <description> --confirm-upload.",
  ].forEach((item) => {
    console.log(`- ${item}`);
  });
}

function gitStatus() {
  try {
    return execFileSync("git", ["status", "--short"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return "";
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function directorySize(directory, includeFile) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return total + directorySize(absolutePath, includeFile);
    }

    if (!entry.isFile() || (includeFile && !includeFile(absolutePath))) {
      return total;
    }

    return total + fs.statSync(absolutePath).size;
  }, 0);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main();
