#!/usr/bin/env node

const dns = require("dns").promises;
const https = require("https");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const config = require(path.join(miniprogramRoot, "config"));

async function main() {
  const checks = [];

  await checkDns(checks, "H5 site DNS", config.SITE_URL);
  await checkHttpsStatus(checks, "H5 site HTTPS", config.SITE_URL, {
    method: "HEAD",
    allowedStatusCodes: [200, 301, 302, 304],
  });

  await checkDns(checks, "Worker DNS", config.REQUEST_DOMAIN);
  await checkHttpsStatus(checks, "Worker protected route", config.API_URL, {
    method: "POST",
    body: JSON.stringify({ prompt: "domain-check" }),
    headers: {
      "Content-Type": "application/json",
    },
    allowedStatusCodes: [401],
    bodyPattern: /Invalid backend access key|backend access key|access key/i,
  });
  await checkHttpsStatus(checks, "Worker protected job route", config.LLM_JOB_URL, {
    method: "POST",
    body: JSON.stringify({ prompt: "domain-check" }),
    headers: {
      "Content-Type": "application/json",
    },
    allowedStatusCodes: [401],
    bodyPattern: /Invalid backend access key|backend access key|access key/i,
  });
  await checkHttpsStatus(checks, "Worker public job route", config.PUBLIC_LLM_JOB_URL, {
    method: "POST",
    body: JSON.stringify({ prompt: "domain-check" }),
    headers: {
      "Content-Type": "application/json",
    },
    allowedStatusCodes: [400],
    bodyPattern: /Missing client id/i,
  });
  await checkHttpsStatus(checks, "Worker admin stats route", config.ADMIN_STATS_URL, {
    method: "GET",
    allowedStatusCodes: [401],
    bodyPattern: /Invalid backend access key|backend access key|access key/i,
  });

  console.log("Mini Program domain check\n");
  checks.forEach((check) => {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.label}`);
    console.log(`     ${check.evidence}`);
  });

  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    console.error(`\nMini Program domain check: ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nMini Program domain check: public domains are reachable.");
}

async function checkDns(checks, label, url) {
  const host = new URL(url).hostname;

  try {
    const records = await dns.resolve(host);
    checks.push({
      label,
      passed: records.length > 0,
      evidence: `${host} -> ${records.join(", ")}`,
    });
  } catch (error) {
    checks.push({
      label,
      passed: false,
      evidence: `${host}: ${error.message}`,
    });
  }
}

async function checkHttpsStatus(checks, label, url, options) {
  const response = await request(url, options);
  const allowedStatusCodes = options.allowedStatusCodes || [];
  const statusPassed = allowedStatusCodes.includes(response.statusCode);
  const bodyPassed = options.bodyPattern
    ? options.bodyPattern.test(response.body || "")
    : true;

  checks.push({
    label,
    passed: !response.error && statusPassed && bodyPassed,
    evidence: response.error
      ? response.error
      : `${options.method} ${url} -> HTTP ${response.statusCode}${response.body ? ` ${response.body.slice(0, 120)}` : ""}`,
  });
}

function request(url, options) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 15000,
    }, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          body,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (error) => {
      resolve({
        error: error.message,
      });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

main();
