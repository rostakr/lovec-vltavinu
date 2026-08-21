const nonEmptyString = value => typeof value === "string" && value.trim().length > 0;
const finiteNumber = value => Number.isFinite(Number(value));
const CANONICAL_LEVEL_ORDER = Object.freeze(["chlum", "nesmen", "besednice", "slavia"]);

const positionInsideBounds = (position, bounds) => (
  finiteNumber(bounds?.x) && finiteNumber(bounds?.y) &&
  finiteNumber(bounds?.width) && finiteNumber(bounds?.height) &&
  finiteNumber(position?.x) && finiteNumber(position?.y) &&
  position.x >= bounds.x && position.x <= bounds.x + bounds.width &&
  position.y >= bounds.y && position.y <= bounds.y + bounds.height
);

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  return [...duplicates];
}

export function validateGameData({ levels, perks, samples } = {}) {
  const errors = [];

  if (!Array.isArray(levels) || levels.length === 0) {
    errors.push("Levels must be a non-empty array.");
  } else {
    const actualLevelIds = levels.map(level => level?.id);
    if (
      actualLevelIds.length !== CANONICAL_LEVEL_ORDER.length ||
      actualLevelIds.some((id, index) => id !== CANONICAL_LEVEL_ORDER[index])
    ) {
      errors.push(`Levels must contain exactly the four canonical levels in order: ${CANONICAL_LEVEL_ORDER.join(", ")}.`);
    }

    const duplicateIds = duplicateValues(actualLevelIds);
    if (duplicateIds.length) errors.push(`Duplicate level ids: ${duplicateIds.join(", ")}`);

    const duplicateOrders = duplicateValues(levels.map(level => level?.order));
    if (duplicateOrders.length) errors.push(`Duplicate level orders: ${duplicateOrders.join(", ")}`);

    const expectedOrders = levels.map((_, index) => index);
    const actualOrders = levels.map(level => level?.order);
    if (actualOrders.some((order, index) => order !== expectedOrders[index])) {
      errors.push("Level order must be contiguous and match array order starting at zero.");
    }

    const finalLevels = levels.filter(level => level?.final === true);
    if (finalLevels.length !== 1) errors.push("Exactly one level must be marked as final.");
    else if (levels.at(-1) !== finalLevels[0]) errors.push("The final level must be the last level.");

    for (const level of levels) {
      const prefix = `Level ${level?.id ?? "(missing id)"}`;
      for (const field of ["id", "name", "title", "scene", "theme", "music", "text", "goal"]) {
        if (!nonEmptyString(level?.[field])) errors.push(`${prefix} has invalid ${field}.`);
      }

      if (!nonEmptyString(level?.briefing?.context) || !nonEmptyString(level?.briefing?.goal)) {
        errors.push(`${prefix} has an invalid briefing.`);
      }
      if (!finiteNumber(level?.spawn?.x) || !finiteNumber(level?.spawn?.y)) {
        errors.push(`${prefix} has an invalid spawn.`);
      }
      if (!finiteNumber(level?.bounds?.x) || !finiteNumber(level?.bounds?.y) ||
          !finiteNumber(level?.bounds?.width) || level.bounds.width <= 0 ||
          !finiteNumber(level?.bounds?.height) || level.bounds.height <= 0) {
        errors.push(`${prefix} has invalid bounds.`);
      }
      const walkable = level?.walkable ?? level?.bounds;
      if (!finiteNumber(walkable?.x) || !finiteNumber(walkable?.y) ||
          !finiteNumber(walkable?.width) || walkable.width <= 0 ||
          !finiteNumber(walkable?.height) || walkable.height <= 0 ||
          !positionInsideBounds({ x: walkable.x, y: walkable.y }, level.bounds) ||
          !positionInsideBounds({ x: walkable.x + walkable.width, y: walkable.y + walkable.height }, level.bounds)) {
        errors.push(`${prefix} has invalid walkable bounds.`);
      }
      if (!positionInsideBounds(level?.spawn, walkable)) errors.push(`${prefix} spawn is outside walkable bounds.`);
      if (!nonEmptyString(level?.objective?.id) || !nonEmptyString(level?.objective?.type) ||
          !Number.isInteger(level?.objective?.required) || level.objective.required < 1) {
        errors.push(`${prefix} has an invalid objective summary.`);
      }

      const targets = Array.isArray(level?.targets) ? level.targets : [];
      if (targets.length === 0) errors.push(`${prefix} must define reachable targets.`);
      const duplicateTargetIds = duplicateValues(targets.map(entry => entry?.id));
      if (duplicateTargetIds.length) errors.push(`${prefix} has duplicate target ids: ${duplicateTargetIds.join(", ")}`);

      const targetById = new Map(targets.map(entry => [entry?.id, entry]));
      for (const entry of targets) {
        if (!nonEmptyString(entry?.id) || !nonEmptyString(entry?.kind) || entry?.reachable !== true) {
          errors.push(`${prefix} contains an invalid or unreachable target.`);
        }
        if (entry?.interaction?.action !== "action" || entry?.interaction?.enabled !== true) {
          errors.push(`${prefix} target ${entry?.id ?? "(missing id)"} must use the context action.`);
        }
        if (!Array.isArray(entry?.positions) || entry.positions.length === 0 ||
            entry.positions.some(position => !positionInsideBounds(position, walkable))) {
          errors.push(`${prefix} target ${entry?.id ?? "(missing id)"} has an unreachable position.`);
        }
      }

      if (!Array.isArray(level?.objectives) || level.objectives.length === 0) {
        errors.push(`${prefix} must define at least one objective.`);
      } else {
        const duplicateObjectiveIds = duplicateValues(level.objectives.map(objective => objective?.id));
        if (duplicateObjectiveIds.length) {
          errors.push(`${prefix} has duplicate objective ids: ${duplicateObjectiveIds.join(", ")}`);
        }
        for (const objective of level.objectives) {
          if (!nonEmptyString(objective?.id) || !nonEmptyString(objective?.type) || !nonEmptyString(objective?.target)) {
            errors.push(`${prefix} contains an invalid objective.`);
          }
          if (!Number.isInteger(objective?.required) || objective.required < 1) {
            errors.push(`${prefix} objective ${objective?.id ?? "(missing id)"} must require a positive integer.`);
          }
          if (objective?.action !== "action") {
            errors.push(`${prefix} objective ${objective?.id ?? "(missing id)"} must use the context action.`);
          }
          const target = targetById.get(objective?.target);
          if (!target) {
            errors.push(`${prefix} objective ${objective?.id ?? "(missing id)"} references a missing target.`);
          } else if (target.reachable !== true || target.interaction?.enabled !== true ||
                     !Array.isArray(target.positions) || target.positions.length < objective.required ||
                     target.positions.some(position => !positionInsideBounds(position, walkable))) {
            errors.push(`${prefix} objective ${objective?.id ?? "(missing id)"} target is not reachable.`);
          }
          if (objective?.type === "dig" && objective.requiredHits !== 3) {
            errors.push(`${prefix} objective ${objective?.id ?? "(missing id)"} must require exactly three rhythm hits.`);
          }
        }
      }

      if (!Array.isArray(level?.hazards)) errors.push(`${prefix} hazards must be an array.`);
      if (!Array.isArray(level?.assetGroups) || level.assetGroups.length === 0) {
        errors.push(`${prefix} assetGroups must be a non-empty array.`);
      }
      const expectedNext = levels[level.order + 1]?.id ?? null;
      if ((level?.next ?? null) !== expectedNext) errors.push(`${prefix} has an invalid next level.`);
    }
  }

  if (!Array.isArray(perks) || perks.length === 0) {
    errors.push("Perks must be a non-empty array.");
  } else {
    const duplicateIds = duplicateValues(perks.map(perk => perk?.id));
    if (duplicateIds.length) errors.push(`Duplicate perk ids: ${duplicateIds.join(", ")}`);
    for (const perk of perks) {
      if (!nonEmptyString(perk?.id) || !nonEmptyString(perk?.name) || !nonEmptyString(perk?.text)) {
        errors.push(`Invalid perk definition: ${perk?.id ?? "(missing id)"}.`);
      }
      if (!Number.isInteger(perk?.max) || perk.max < 1) errors.push(`Perk ${perk?.id ?? "(missing id)"} has invalid max.`);
    }
  }

  if (!Array.isArray(samples) || samples.length < 2) {
    errors.push("Samples must contain at least two entries.");
  } else {
    const duplicateIds = duplicateValues(samples.map(sample => sample?.id));
    if (duplicateIds.length) errors.push(`Duplicate sample ids: ${duplicateIds.join(", ")}`);
    if (!samples.some(sample => sample?.real === true)) errors.push("Samples must include at least one real moldavite.");
    if (!samples.some(sample => sample?.real === false)) errors.push("Samples must include at least one false sample.");
    for (const sample of samples) {
      if (!nonEmptyString(sample?.id) || !nonEmptyString(sample?.title) || !nonEmptyString(sample?.text) || typeof sample?.real !== "boolean") {
        errors.push(`Invalid sample definition: ${sample?.id ?? "(missing id)"}.`);
      }
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function assertValidGameData(data) {
  const result = validateGameData(data);
  if (!result.valid) {
    const error = new Error(`Invalid game data:\n- ${result.errors.join("\n- ")}`);
    error.name = "GameDataValidationError";
    error.errors = result.errors;
    throw error;
  }
  return data;
}
