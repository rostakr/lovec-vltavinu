import fs from "node:fs";
import { test, expect } from "@playwright/test";

async function openPlaying(page) {
  const pageErrors = [];
  const httpErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#titleScreen")).toHaveClass(/visible/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__lovecRuntime))).toBe(true);
  await page.locator("#playButton").tap();
  await expect(page.locator("#briefScreen")).toHaveClass(/visible/);
  await page.locator("#briefButton").tap();
  await expect(page.locator("#app")).toHaveClass(/playing/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__lovecRuntime.snapshot().chlum?.runtime?.player))).toBe(true);
  return { pageErrors, httpErrors };
}

async function snapshot(page) {
  return page.evaluate(() => window.__lovecRuntime.snapshot());
}

async function inputSnapshot(page) {
  return page.evaluate(async () => {
    const { app } = await import("./src/bootstrap.js");
    return app.input.snapshot();
  });
}

async function expectReleasedInput(page) {
  await expect.poll(async () => {
    const input = await inputSnapshot(page);
    return {
      move: input.axes.move?.length ?? 0,
      action: Boolean(input.actions.action?.down),
      pause: Boolean(input.actions.pause?.down)
    };
  }).toEqual({ move: 0, action: false, pause: false });
}

async function beginJoystick(page, axisX, axisY) {
  const zone = page.locator("#moveZone");
  await expect(zone).toBeVisible();
  const box = await zone.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Mobile joystick has no bounding box.");

  const radius = Math.max(1, Math.min(box.width, box.height) / 2);
  const length = Math.hypot(axisX, axisY) || 1;
  const x = Math.round(box.x + box.width / 2 + axisX / length * radius * 0.78);
  const y = Math.round(box.y + box.height / 2 - axisY / length * radius * 0.78);
  const client = await page.context().newCDPSession(page);
  let active = true;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1 }]
  });
  return async () => {
    if (!active) return;
    active = false;
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }).catch(() => {});
    await client.detach().catch(() => {});
  };
}

async function captureEvidence(page, testInfo, name, expectedSize) {
  const directory = testInfo.outputPath("visual-evidence");
  fs.mkdirSync(directory, { recursive: true });
  const path = `${directory}/${name}.png`;
  const image = await page.screenshot({ path, animations: "disabled", caret: "hide", scale: "device", timeout: 20_000 });
  expect({ width: image.readUInt32BE(16), height: image.readUInt32BE(20) }).toEqual(expectedSize);
  await testInfo.attach(name, { path, contentType: "image/png" });
}

const compactTransform = value => String(value).replace(/\s+/g, "");

test("real touch joystick moves the player and runtime reset releases it", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = await openPlaying(page);
  const before = await snapshot(page);
  const startX = before.chlum.runtime.player.x;
  const stick = page.locator("#stick");
  const release = await beginJoystick(page, 1, 0);
  try {
    await expect.poll(async () => (await inputSnapshot(page)).axes.move?.x ?? 0).toBeGreaterThan(0.5);
    await expect.poll(async () => compactTransform(await stick.evaluate(element => element.style.transform)))
      .not.toBe("translate(-50%,-50%)");
    await expect.poll(async () => (await snapshot(page)).chlum.runtime.player.x).toBeGreaterThan(startX + 20);
    await page.evaluate(() => window.__lovecRuntime.resetInput("playwright-mobile-reset"));
    await expectReleasedInput(page);
    await expect.poll(async () => compactTransform(await stick.evaluate(element => element.style.transform)))
      .toBe("translate(-50%,-50%)");
  } finally {
    await release();
  }
  await expectReleasedInput(page);
  expect(errors.httpErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test("orientation, pause and background transitions release mobile input", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const errors = await openPlaying(page);
  await captureEvidence(page, testInfo, "mobile-lifecycle-portrait", { width: 1170, height: 2532 });

  const release = await beginJoystick(page, 0, 1);
  await expect.poll(async () => (await inputSnapshot(page)).axes.move?.y ?? 0).toBeGreaterThan(0.5);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("orientationchange"));
    window.__lovecRuntime.resize();
  });
  await release();
  await expect.poll(() => page.evaluate(() => window.__lovecRuntime.snapshot().renderer.width)).toBe(844);
  await expectReleasedInput(page);
  await captureEvidence(page, testInfo, "mobile-lifecycle-landscape", { width: 2532, height: 1170 });

  await page.locator("#pauseButton").tap();
  await expect(page.locator("#pauseScreen")).toHaveClass(/visible/);
  await expectReleasedInput(page);
  await page.locator("#resumeButton").tap();
  await expect(page.locator("#app")).toHaveClass(/playing/);
  await expectReleasedInput(page);

  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(120);
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => window.__lovecRuntime.snapshot().running)).toBe(true);
  await expectReleasedInput(page);
  await other.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("orientationchange"));
    window.__lovecRuntime.resize();
  });
  await expectReleasedInput(page);
  expect(errors.httpErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});
