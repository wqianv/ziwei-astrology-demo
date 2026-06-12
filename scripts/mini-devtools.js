#!/usr/bin/env node

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const project = path.join(root, "miniprogram");
const cli = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const defaultPort = "21481";
const artifactDir = path.join(os.tmpdir(), "ziwei-mini-devtools");

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  ensureCli();
  const options = parseArgs(args);

  if (command === "preview") {
    preview(options);
    return;
  }

  if (command === "upload") {
    upload(options);
    return;
  }

  fail(`Unknown command: ${command}`);
}

function preview(options) {
  runReadiness();
  runPreflight();
  ensureArtifactDir();

  const stamp = timestamp();
  const qrOutput = options["qr-output"] || path.join(artifactDir, `preview-${stamp}.png`);
  const infoOutput = options["info-output"] || path.join(artifactDir, `preview-${stamp}.json`);
  const port = options.port || defaultPort;

  runCli([
    "preview",
    "--project",
    project,
    "--port",
    port,
    "--qr-format",
    options["qr-format"] || "image",
    "--qr-output",
    qrOutput,
    "--info-output",
    infoOutput,
  ]);

  console.log(`\nPreview QR: ${qrOutput}`);
  console.log(`Preview info: ${infoOutput}`);
}

function upload(options) {
  const version = options.version || options.v;
  const desc = options.desc || options.d;

  if (!version || !desc) {
    fail("Upload requires --version <version> and --desc <description>.");
  }

  if (options["confirm-upload"] !== true) {
    fail("Upload requires --confirm-upload to create a WeChat backend draft.");
  }

  runReadiness();
  runPreflight();
  ensureArtifactDir();

  const infoOutput = options["info-output"] || path.join(artifactDir, `upload-${timestamp()}.json`);
  const port = options.port || defaultPort;

  runCli([
    "upload",
    "--project",
    project,
    "--port",
    port,
    "--version",
    version,
    "--desc",
    desc,
    "--info-output",
    infoOutput,
  ]);

  console.log(`\nUpload info: ${infoOutput}`);
}

function runReadiness() {
  execFileSync("npm", ["run", "mini:readiness"], {
    cwd: root,
    stdio: "inherit",
  });
}

function runPreflight() {
  execFileSync("npm", ["run", "mini:preflight"], {
    cwd: root,
    stdio: "inherit",
  });
}

function runCli(args) {
  const result = spawnSync(cli, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--") && !arg.startsWith("-")) {
      continue;
    }

    const key = arg.replace(/^-+/, "");
    const next = args[index + 1];

    if (!next || next.startsWith("-")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function ensureCli() {
  if (!fs.existsSync(cli)) {
    fail(`WeChat DevTools CLI not found: ${cli}`);
  }
}

function ensureArtifactDir() {
  fs.mkdirSync(artifactDir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function printHelp() {
  console.log([
    "Usage:",
    "  npm run mini:preview",
    "  npm run mini:upload -- --version <version> --desc <description> --confirm-upload",
    "",
    "Options:",
    "  --port <port>           WeChat DevTools service port, default 21481",
    "  --qr-output <path>      Preview QR output path",
    "  --info-output <path>    Preview/upload info output path",
    "  --confirm-upload        Required for upload; creates a WeChat backend draft",
  ].join("\n"));
}

main();
