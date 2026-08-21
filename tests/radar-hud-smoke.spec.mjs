import { test, expect } from "@playwright/test";

async function emitRadarModel(page, hint, revision) {
  await page.evaluate(async ({ text, rev }) => {
    const { events } = await import("./src/bootstrap.js");
    events.emit("hud:model:changed", {
      revision: rev,
      model: {
        missionNumber: 1,
        placeLabel: "Chlum",
        objective: "Najdi vltavín pomocí radaru",
        objectiveProgress: 0.5,
        findings: 1,
        danger: 0.12,
        dangerMessage: "",
        hint: text,
        actionReady: true,
        actionLabel: "RADAR",
        actionIcon: "⌕"
      }
    });
  }, { text: hint, rev: revision });
}

async function assertInsideViewport(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must have a layout box`).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
}

test("V7 HUD and radar stay visible outside the Chlum root scope", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/?debug=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#titleScreen")).toHaveClass(/visible/);
  await page.locator("#playButton").tap();
  await expect(page.locator("#briefScreen")).toHaveClass(/visible/);
  await page.locator("#briefButton").tap();
  await expect(page.locator("#app")).toHaveClass(/playing/);
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

  // Simulate leaving Chlum: the old implementation lost its V7 HUD styles here.
  await page.evaluate(() => document.documentElement.classList.remove("v7-visual-rebuild"));
  await expect(page.locator(".mission-panel")).toHaveCSS("display", "flex");
  await expect(page.locator(".system-panel .bag-pill")).toHaveCSS("display", "flex");
  await assertInsideViewport(page, ".mission-panel");
  await assertInsideViewport(page, ".system-panel .bag-pill");

  await emitRadarModel(page, "Radar: slabý signál. Pokračuj v hledání po poli.", 9001);
  await expect(page.locator("#radarPanel")).not.toHaveClass(/hidden/);
  await expect(page.locator("#radarPanel")).toHaveAttribute("data-signal", "weak");
  await expect(page.locator("#radarState")).toHaveText("SLABÝ");
  await expect(page.locator("#radarFill")).toHaveCSS("width", /.+/);
  await expect(page.locator("#bagValue")).toHaveText("1");
  await assertInsideViewport(page, "#radarPanel");

  await emitRadarModel(page, "Radar: silný signál. Vltavín je velmi blízko.", 9002);
  await expect(page.locator("#radarPanel")).toHaveAttribute("data-signal", "strong");
  await expect(page.locator("#radarState")).toHaveText("SILNÝ");
  await expect(page.locator("#radarPanel")).toHaveAttribute("aria-valuenow", "82");

  await emitRadarModel(page, "Radar odhalil vltavín. Přibliž se a stiskni SEBRAT.", 9003);
  await expect(page.locator("#radarPanel")).toHaveAttribute("data-signal", "target");
  await expect(page.locator("#radarState")).toHaveText("CÍL");
  await expect(page.locator("#radarPanel")).toHaveAttribute("aria-valuenow", "100");

  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  await assertInsideViewport(page, ".mission-panel");
  await assertInsideViewport(page, "#radarPanel");
  await assertInsideViewport(page, "#actionButton");
});
