#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultArtifactDir = "/tmp/ziwei-mini-devtools";

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || options.h) {
    printHelp();
    return;
  }

  const artifactDir = path.resolve(
    options["artifact-dir"] ||
      process.env.MINI_ARTIFACT_DIR ||
      defaultArtifactDir,
  );
  const latestPreview = options.source || findLatestPreview(artifactDir);
  const output = path.resolve(
    options.output ||
      path.join(artifactDir, `phone-qa-${timestamp()}.md`),
  );

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, buildRecord({
    commit: git(["rev-parse", "--short", "HEAD"]),
    date: new Date().toISOString(),
    previewSource: latestPreview || "not found - run npm run mini:preview first",
  }));

  console.log(`Phone QA record: ${output}`);
  console.log(`Preview source: ${latestPreview || "not found"}`);
  console.log("Do not paste backend access keys, model API keys, or other secrets into this record.");
}

function findLatestPreview(artifactDir) {
  if (!fs.existsSync(artifactDir)) {
    return "";
  }

  const previews = fs.readdirSync(artifactDir)
    .filter((file) => /^preview-.+\.png$/.test(file))
    .map((file) => {
      const absolutePath = path.join(artifactDir, file);
      return {
        absolutePath,
        mtimeMs: fs.statSync(absolutePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return previews.length > 0 ? previews[0].absolutePath : "";
}

function buildRecord({ commit, date, previewSource }) {
  return [
    "# Phone QA Record",
    "",
    "Use this file as the manual QA record after scanning a preview QR or opening an experience version on a real phone.",
    "Do not paste backend access keys, model API keys, or other secrets here.",
    "",
    "## Run Metadata",
    "",
    `- Date: ${date}`,
    "- Tester:",
    "- Phone model / OS:",
    "- WeChat version:",
    "- Mini Program source: preview QR / experience version",
    `- Preview QR or experience version: ${previewSource}`,
    `- Git commit: ${commit}`,
    "- Backend access key source: temporary reviewer key / local owner key / not tested",
    "",
    "## Required Checks",
    "",
    "Mark each item as `PASS`, `FAIL`, or `N/A`, then add a short note when useful.",
    "",
    "| Result | Check | Notes |",
    "| --- | --- | --- |",
    "|  | Home page opens and the three action buttons are aligned. |  |",
    "|  | Native chart page opens without horizontal scrolling. |  |",
    "|  | Birth date, birth time, and gender changes refresh the local summary cards. |  |",
    "|  | Birth profile restores after reopening, and `重置出生信息` clears the saved profile. |  |",
    "|  | The 4x4 Ziwei board fits the phone width and palace selection updates the detail card. |  |",
    "|  | Settings page saves and clears the backend access key locally. |  |",
    "|  | Settings page backend test succeeds, or shows a readable domain/key/network error. |  |",
    "|  | Settings page can copy diagnostic text without including the backend access key. |  |",
    "|  | Settings page `清除本机数据` resets local key, birth profile, send consent, and latest report cache. |  |",
    "|  | LLM generation stays disabled until both the key is saved and send consent is selected. |  |",
    "|  | Slow LLM requests show progress text, and a successful response fills sectioned report cards. |  |",
    "|  | Reopening the same birth profile restores the latest local LLM report. |  |",
    "|  | `清除本机解读` removes the local report cache. |  |",
    "|  | `复制解读` copies the sectioned report with a usage-boundary note and no backend access key. |  |",
    "|  | Home/native/web-view share entries behave as expected. |  |",
    "|  | Web-view entry opens `https://www.tanxj.xyz` after the business domain is accepted by WeChat. |  |",
    "",
    "## Result Summary",
    "",
    "- Overall result:",
    "- Blocking issues:",
    "- Non-blocking polish:",
    "- Follow-up owner:",
    "",
  ].join("\n");
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return "unknown";
  }
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.replace(/^--/, "");
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printHelp() {
  console.log([
    "Usage:",
    "  npm run mini:phone-qa",
    "",
    "Options:",
    "  --artifact-dir <path>   Preview/QA artifact directory, default /tmp/ziwei-mini-devtools",
    "  --source <path>         Preview QR path or experience-version reference",
    "  --output <path>         QA record output path",
    "",
    "The generated QA record is local and must not contain backend access keys, model API keys, or other secrets.",
  ].join("\n"));
}

main();
