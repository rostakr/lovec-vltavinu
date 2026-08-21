import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "@playwright/test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FULL_FLOW_TITLE = "Chlum → Nesměň → Besednice → Slavia uses the project-native input and cleanly restarts";
const PROFILES = Object.freeze([
  {
    id: "desktop-chromium",
    context: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } }
  },
  {
    id: "iphone-portrait",
    context: {
      ...devices["iPhone 13"],
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 }
    }
  },
  {
    id: "iphone-landscape",
    context: {
      ...devices["iPhone 13"],
      viewport: { width: 844, height: 390 },
      screen: { width: 844, height: 390 }
    }
  }
]);

function parseArgs(argv) {
  const options = {
    outputDir: "artifacts/performance",
    label: "current",
    compare: null,
    skipFullFlow: false,
    skipProbe: false
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--output-dir") options.outputDir = argv[++index];
    else if (argument === "--label") options.label = argv[++index];
    else if (argument === "--compare") options.compare = argv[++index];
    else if (argument === "--skip-full-flow") options.skipFullFlow = true;
    else if (argument === "--skip-probe") options.skipProbe = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.outputDir) throw new Error("--output-dir requires a path.");
  if (!options.label) throw new Error("--label requires a value.");
  return options;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", chunk => { stdout += chunk; });
    child.stderr?.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}.\n${stderr || stdout}`));
    });
  });
}

async function gitHead() {
  const { stdout } = await run("git", ["rev-parse", "HEAD"], { capture: true });
  return stdout.trim();
}

function findFullFlowDuration(report) {
  const durations = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value.title === FULL_FLOW_TITLE && Array.isArray(value.tests)) {
      for (const test of value.tests) {
        for (const result of test.results ?? []) {
          if (result.status === "passed" && Number.isFinite(result.duration)) durations.push(result.duration);
        }
      }
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(report);
  if (durations.length !== 1) {
    throw new Error(`Expected one passed full-flow result, found ${durations.length}.`);
  }
  return durations[0];
}

async function runFullFlow(profile) {
  const startedAt = performance.now();
  const { stdout } = await run(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["playwright", "test", "tests/slavia-smoke.spec.mjs", `--project=${profile.id}`, "--reporter=json"],
    { capture: true, env: { CI: "" } }
  );
  const wallClockMs = performance.now() - startedAt;
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Playwright JSON reporter returned invalid JSON for ${profile.id}: ${error.message}`);
  }
  return Object.freeze({
    testDurationMs: findFullFlowDuration(report),
    runnerWallClockMs: Math.round(wallClockMs),
    limitMs: 480_000,
    withinLimit: wallClockMs < 480_000
  });
}

async function waitForServer(url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready at ${url}.`);
}

async function startServer() {
  const child = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.once("exit", code => {
    if (code && code !== 0) console.error(`Performance probe server exited with ${code}: ${stderr}`);
  });
  await waitForServer("http://127.0.0.1:4173/index.html");
  return child;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(3));
}

async function runProbe(browser, profile) {
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();
  const pageErrors = [];
  const httpErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.addInitScript(() => {
    window.__a5FrameTimes = [];
    let previous = null;
    const sample = now => {
      if (previous !== null) window.__a5FrameTimes.push(now - previous);
      previous = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("http://127.0.0.1:4173/index.html?debug=performance", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__lovecRuntime));
  await page.locator("#soundButton").click();
  await page.waitForFunction(() => ["ready", "muted"].includes(window.__lovecRuntime.snapshot().audio.state));
  await page.locator("#playButton").click();
  await page.locator("#briefButton").click();
  await page.waitForFunction(() => window.__lovecRuntime.snapshot().scene === "chlum");
  await page.waitForTimeout(5_000);

  const metrics = await page.evaluate(() => {
    const runtime = window.__lovecRuntime.snapshot();
    const canvas = document.getElementById("game");
    const audioResources = performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("/assets/audio/"))
      .map(entry => ({
        name: entry.name.split("/").pop(),
        durationMs: Number(entry.duration.toFixed(3)),
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize
      }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
      renderer: runtime.renderer,
      audio: runtime.audio,
      audioResources,
      frameTimes: window.__a5FrameTimes.slice(30)
    };
  });

  await context.close();
  return Object.freeze({
    viewport: metrics.viewport,
    devicePixelRatio: metrics.devicePixelRatio,
    canvas: metrics.canvas,
    renderer: metrics.renderer,
    audio: metrics.audio,
    audioResources: metrics.audioResources,
    frameTime: {
      samples: metrics.frameTimes.length,
      p50Ms: percentile(metrics.frameTimes, 0.5),
      p95Ms: percentile(metrics.frameTimes, 0.95),
      maxMs: metrics.frameTimes.length ? Number(Math.max(...metrics.frameTimes).toFixed(3)) : null
    },
    pageErrors,
    httpErrors
  });
}

function delta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  return Number((current - baseline).toFixed(3));
}

function comparisonFor(report, baseline) {
  if (!baseline?.profiles) return null;
  const comparison = {};
  for (const profile of PROFILES) {
    const current = report.profiles[profile.id];
    const previous = baseline.profiles[profile.id];
    if (!current || !previous) continue;
    comparison[profile.id] = {
      fullFlowTestDurationDeltaMs: delta(current.fullFlow?.testDurationMs, previous.fullFlow?.testDurationMs),
      frameP50DeltaMs: delta(current.probe?.frameTime?.p50Ms, previous.probe?.frameTime?.p50Ms),
      frameP95DeltaMs: delta(current.probe?.frameTime?.p95Ms, previous.probe?.frameTime?.p95Ms)
    };
  }
  return comparison;
}

function markdown(report) {
  const lines = [
    `# Performance report — ${report.label}`,
    "",
    `- Head SHA: \`${report.headSha}\``,
    `- Generated: ${report.generatedAt}`,
    `- Full-flow timeout unchanged: \`480000 ms\``,
    "",
    "| Profile | Full-flow test | Wall clock | DPR | Internal renderer | Frame p50 | Frame p95 | Audio load |",
    "|---|---:|---:|---:|---:|---:|---:|---:|"
  ];
  for (const profile of PROFILES) {
    const result = report.profiles[profile.id];
    const audioMs = result.probe?.audioResources?.reduce((sum, entry) => sum + entry.durationMs, 0) ?? null;
    lines.push(`| ${profile.id} | ${result.fullFlow?.testDurationMs ?? "n/a"} ms | ${result.fullFlow?.runnerWallClockMs ?? "n/a"} ms | ${result.probe?.devicePixelRatio ?? "n/a"} | ${result.probe ? `${result.probe.renderer.width}×${result.probe.renderer.height}` : "n/a"} | ${result.probe?.frameTime?.p50Ms ?? "n/a"} ms | ${result.probe?.frameTime?.p95Ms ?? "n/a"} ms | ${audioMs === null ? "n/a" : `${audioMs.toFixed(3)} ms`} |`);
  }
  lines.push("", "## Errors", "");
  for (const profile of PROFILES) {
    const probe = report.profiles[profile.id].probe;
    lines.push(`- ${profile.id}: page errors ${probe?.pageErrors?.length ?? "n/a"}, HTTP errors ${probe?.httpErrors?.length ?? "n/a"}`);
  }
  if (report.comparison) {
    lines.push("", "## Comparison", "", "```json", JSON.stringify(report.comparison, null, 2), "```");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(ROOT, options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const report = {
    schemaVersion: 1,
    label: options.label,
    generatedAt: new Date().toISOString(),
    headSha: await gitHead(),
    command: process.argv.join(" "),
    profiles: {}
  };

  if (!options.skipFullFlow) {
    for (const profile of PROFILES) {
      report.profiles[profile.id] = { fullFlow: await runFullFlow(profile) };
    }
  } else {
    for (const profile of PROFILES) report.profiles[profile.id] = {};
  }

  if (!options.skipProbe) {
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    try {
      for (const profile of PROFILES) {
        report.profiles[profile.id].probe = await runProbe(browser, profile);
      }
    } finally {
      await browser.close();
      server.kill("SIGTERM");
    }
  }

  if (options.compare) {
    const baseline = JSON.parse(await readFile(path.resolve(ROOT, options.compare), "utf8"));
    report.comparison = comparisonFor(report, baseline);
  }

  const jsonPath = path.join(outputDir, `${options.label}-performance-report.json`);
  const markdownPath = path.join(outputDir, `${options.label}-performance-report.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, markdown(report));
  console.log(`Performance report written to ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, markdownPath)}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
