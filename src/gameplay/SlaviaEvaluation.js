const RARITY_WEIGHT = Object.freeze({ A: 3, B: 2, C: 1 });

function finiteNonNegative(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative finite number.`);
  }
  return value;
}

function normalizeFinding(finding) {
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    throw new TypeError("Finding must be an object.");
  }

  const findingId = String(finding.findingId ?? "").trim();
  const locality = String(finding.locality ?? "").trim();
  const rarity = String(finding.rarity ?? "").trim().toUpperCase();
  if (!findingId) throw new TypeError("findingId must be a non-empty string.");
  if (!locality) throw new TypeError("locality must be a non-empty string.");
  if (!(rarity in RARITY_WEIGHT)) throw new TypeError(`Unknown finding rarity: ${rarity}`);

  return Object.freeze({
    findingId,
    locality,
    rarity,
    weight: finiteNonNegative(finding.weight, "weight"),
    score: Math.round(finiteNonNegative(finding.score, "score"))
  });
}

export function evaluateSlaviaCollection(sessionState) {
  if (!sessionState || typeof sessionState !== "object" || Array.isArray(sessionState)) {
    throw new TypeError("Session state must be an object.");
  }

  const findings = Array.isArray(sessionState.findings)
    ? sessionState.findings.map(normalizeFinding)
    : [];
  const score = Math.round(finiteNonNegative(sessionState.score ?? 0, "score"));
  const uniqueIds = new Set(findings.map(finding => finding.findingId));
  if (uniqueIds.size !== findings.length) throw new Error("Session findings must have unique findingId values.");

  const rarityPoints = findings.reduce((total, finding) => total + RARITY_WEIGHT[finding.rarity], 0);
  const totalWeight = Number(findings.reduce((total, finding) => total + finding.weight, 0).toFixed(2));
  const localities = [...new Set(findings.map(finding => finding.locality))].sort();
  const bestFinding = findings
    .slice()
    .sort((left, right) => (
      right.score - left.score ||
      RARITY_WEIGHT[right.rarity] - RARITY_WEIGHT[left.rarity] ||
      right.weight - left.weight ||
      left.findingId.localeCompare(right.findingId)
    ))[0] ?? null;

  const award = findings.length >= 3 && localities.length >= 3 && score >= 500
    ? "grand-prize"
    : findings.length >= 2 && score >= 250
      ? "jury-recognition"
      : "participant";

  return Object.freeze({
    findingCount: findings.length,
    localityCount: localities.length,
    localities: Object.freeze(localities),
    totalWeight,
    rarityPoints,
    score,
    bestFindingId: bestFinding?.findingId ?? null,
    award
  });
}
