import { test, expect } from "@playwright/test";

test("V7.1 dig smoke covers miss, perfect dig and clean bonus feedback", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#titleScreen")).toHaveClass(/visible/);
  await page.locator("#playButton").click();
  await expect(page.locator("#briefScreen")).toHaveClass(/visible/);
  await page.locator("#briefButton").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

  const missRun = await page.evaluate(async () => {
    const { DigSystem } = await import("./src/gameplay/DigSystem.js");
    const { BESEDNICE_DIG_CONFIG } = await import("./src/scenes/BesedniceScene.js");
    const dig = new DigSystem(BESEDNICE_DIG_CONFIG);
    dig.start("smoke-miss");
    dig.active.position = 0.1;
    const miss = dig.strike();
    for (let hit = 0; hit < 3; hit++) {
      dig.active.position = 0.5;
      dig.strike();
    }
    return { miss, final: dig.snapshot() };
  });

  expect(missRun.miss.hit).toBe(false);
  expect(missRun.final.hits).toBe(3);
  expect(missRun.final.misses).toBe(1);
  expect(missRun.final.complete).toBe(true);
  await expect(page.locator("#toast")).not.toHaveText("ČISTÉ KOPÁNÍ +10 %");

  const cleanRun = await page.evaluate(async () => {
    const { DigSystem } = await import("./src/gameplay/DigSystem.js");
    const { BESEDNICE_DIG_CONFIG } = await import("./src/scenes/BesedniceScene.js");
    const { events } = await import("./src/bootstrap.js");
    const dig = new DigSystem(BESEDNICE_DIG_CONFIG);
    dig.start("smoke-clean");
    let result = null;
    for (let hit = 0; hit < 3; hit++) {
      dig.active.position = 0.5;
      result = dig.strike();
    }
    if (result?.complete && result.hits === 3 && result.misses === 0) {
      events.emit("dig:clean", { spot: "smoke-clean" });
    }
    return dig.snapshot();
  });

  expect(cleanRun.hits).toBe(3);
  expect(cleanRun.misses).toBe(0);
  expect(cleanRun.complete).toBe(true);
  await expect(page.locator("#toast")).toHaveText("ČISTÉ KOPÁNÍ +10 %");
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await expect(page.locator("#toast")).toHaveAttribute("aria-hidden", "false");
});
