import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LEVEL_DEFINITIONS } from "../../src/data/levels.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inside = (point, area) => (
  point.x >= area.x && point.x <= area.x + area.width &&
  point.y >= area.y && point.y <= area.y + area.height
);

test("every spawn and mandatory target stays inside its environment-specific walkable area", () => {
  for (const level of LEVEL_DEFINITIONS) {
    assert.ok(level.walkable, `${level.id} must define walkable bounds`);
    assert.ok(inside(level.spawn, level.walkable), `${level.id} spawn`);
    for (const target of level.targets) {
      for (const position of target.positions) {
        assert.ok(inside(position, level.walkable), `${level.id}:${target.id}`);
      }
    }
  }
});

test("production scenes clamp movement to walkable bounds instead of image bounds", () => {
  for (const scene of ["ChlumScene.js", "NesmenScene.js", "BesedniceScene.js", "SlaviaScene.js"]) {
    const source = fs.readFileSync(path.join(root, "src/scenes", scene), "utf8");
    assert.match(source, /const walkable = this\.level\.walkable \?\? this\.level\.bounds/);
    assert.doesNotMatch(source, /clamp\([^\n]+this\.level\.bounds\.x \+ 28/);
  }
});

test("Slavia walkable area keeps the player out of the river", () => {
  const slavia = LEVEL_DEFINITIONS.find(level => level.id === "slavia");
  assert.ok(slavia.walkable.x >= 340);
  assert.ok(slavia.spawn.x >= slavia.walkable.x);
  assert.ok(slavia.targets.every(target => target.positions.every(position => inside(position, slavia.walkable))));
});
