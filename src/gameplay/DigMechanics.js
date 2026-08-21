// Core digging mechanics - finding resolution, danger, and scoring

import { resolveVariant, createFinding, scaleScore } from "./FindingResolver.js";

export class DigMechanics {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.rng = options.rng || (() => Math.random());
    this.config = {
      dangerChanceByDifficulty: {
        easy: 0.15,
        normal: 0.25,
        hard: 0.35
      },
      hitsRequiredByDifficulty: {
        easy: 2,
        normal: 3,
        hard: 4
      },
      findingChances: {
        A: 0.05,
        B: 0.25,
        C: 0.70
      },
      ...options.config
    };
  }

  // Resolve a complete dig action
  resolveDig(digSiteData, difficulty = "normal") {
    const result = {
      siteIndex: digSiteData.index,
      danger: null,
      finding: null,
      score: 0,
      location: digSiteData.location,
      perfect: false
    };

    // Check for danger
    const dangerChance = this.config.dangerChanceByDifficulty[difficulty] || 0.25;
    if (this.rng() < dangerChance) {
      result.danger = this.resolveDanger(digSiteData.location, difficulty);
    }

    // If no danger or after handling danger, resolve finding
    if (!result.danger || digSiteData.allowFindingWithDanger !== false) {
      result.finding = this.resolveOreFinding(digSiteData, difficulty);
      if (result.finding) {
        result.score = result.finding.score;
        result.perfect = this.isPerfectDig(digSiteData);
        if (result.perfect) {
          result.score = Math.round(result.score * 1.15);
        }
      }
    }

    return result;
  }

  // Resolve what ore/finding is obtained
  resolveOreFinding(digSiteData, difficulty) {
    if (!digSiteData.variants || digSiteData.variants.length === 0) {
      return null;
    }

    // Determine rarity based on quality and difficulty
    const quality = this.getDigQuality(difficulty);
    const variant = resolveVariant(digSiteData.variants, quality, this.rng);

    if (!variant) return null;

    const finding = createFinding(
      variant,
      `${digSiteData.location}-${digSiteData.index}-${Date.now()}`,
      digSiteData.location,
      quality,
      { perfect: this.isPerfectDig(digSiteData) }
    );

    return finding;
  }

  // Resolve danger event for location
  resolveDanger(location, difficulty) {
    const dangerEvents = {
      chlum: {
        type: "tractor",
        message: "⚠️ TRAKTOR BLÍZKO!",
        damage: 1
      },
      nesmen: {
        type: "forester",
        message: "⚠️ Lesník kontroluje!",
        damage: 1
      },
      besednice: {
        type: "drought",
        message: "⚠️ Sucho! Zemina se zbortila!",
        damage: 1
      },
      slavia: {
        type: "guard",
        message: "⚠️ Podezřelá osoba!",
        damage: 1
      }
    };

    return dangerEvents[location] || { type: "danger", message: "⚠️ Nebezpečí!", damage: 1 };
  }

  // Calculate dig quality (0-1) based on difficulty and random factor
  getDigQuality(difficulty) {
    const baseQuality = {
      easy: 0.7,
      normal: 0.5,
      hard: 0.4
    }[difficulty] || 0.5;

    const randomFactor = this.rng() * 0.3;
    return Math.min(1, baseQuality + randomFactor);
  }

  // Check if dig was perfect (no wastage, clean extraction)
  isPerfectDig(digSiteData) {
    return this.rng() < 0.15; // 15% chance of perfect dig
  }

  // Get required hits for difficulty
  getRequiredHits(difficulty = "normal") {
    return this.config.hitsRequiredByDifficulty[difficulty] || 3;
  }

  // Get danger chance for difficulty
  getDangerChance(difficulty = "normal") {
    return this.config.dangerChanceByDifficulty[difficulty] || 0.25;
  }
}

// Dig site definitions for each location
export const DIG_SITE_VARIANTS = {
  chlum: [
    {
      index: 0,
      location: "chlum",
      depth: "surface",
      variants: [
        { rarity: "C", weight: 1, score: 50 },
        { rarity: "B", weight: 0.5, score: 200 },
        { rarity: "A", weight: 0.1, score: 500 }
      ]
    },
    {
      index: 1,
      location: "chlum",
      depth: "shallow",
      variants: [
        { rarity: "C", weight: 1, score: 60 },
        { rarity: "B", weight: 0.6, score: 220 },
        { rarity: "A", weight: 0.15, score: 550 }
      ]
    },
    {
      index: 2,
      location: "chlum",
      depth: "medium",
      variants: [
        { rarity: "C", weight: 1, score: 70 },
        { rarity: "B", weight: 0.7, score: 250 },
        { rarity: "A", weight: 0.2, score: 600 }
      ]
    }
  ],
  nesmen: [
    {
      index: 0,
      location: "nesmen",
      depth: "profile1",
      variants: [
        { rarity: "C", weight: 1, score: 55 },
        { rarity: "B", weight: 0.55, score: 210 },
        { rarity: "A", weight: 0.12, score: 520 }
      ]
    },
    {
      index: 1,
      location: "nesmen",
      depth: "profile2",
      variants: [
        { rarity: "C", weight: 1, score: 65 },
        { rarity: "B", weight: 0.65, score: 240 },
        { rarity: "A", weight: 0.18, score: 580 }
      ]
    },
    {
      index: 2,
      location: "nesmen",
      depth: "profile3",
      variants: [
        { rarity: "C", weight: 1, score: 75 },
        { rarity: "B", weight: 0.75, score: 270 },
        { rarity: "A", weight: 0.25, score: 650 }
      ]
    }
  ],
  besednice: [
    {
      index: 0,
      location: "besednice",
      depth: "clay",
      variants: [
        { rarity: "C", weight: 1, score: 60 },
        { rarity: "B", weight: 0.6, score: 220 },
        { rarity: "A", weight: 0.15, score: 550 }
      ]
    },
    {
      index: 1,
      location: "besednice",
      depth: "quarry",
      variants: [
        { rarity: "C", weight: 1, score: 70 },
        { rarity: "B", weight: 0.7, score: 250 },
        { rarity: "A", weight: 0.2, score: 600 }
      ]
    },
    {
      index: 2,
      location: "besednice",
      depth: "terracotta",
      variants: [
        { rarity: "C", weight: 1, score: 80 },
        { rarity: "B", weight: 0.8, score: 280 },
        { rarity: "A", weight: 0.25, score: 700 }
      ]
    }
  ],
  slavia: [
    {
      index: 0,
      location: "slavia",
      depth: "ruin1",
      variants: [
        { rarity: "C", weight: 1, score: 65 },
        { rarity: "B", weight: 0.65, score: 240 },
        { rarity: "A", weight: 0.2, score: 600 }
      ]
    },
    {
      index: 1,
      location: "slavia",
      depth: "ruin2",
      variants: [
        { rarity: "C", weight: 1, score: 75 },
        { rarity: "B", weight: 0.75, score: 270 },
        { rarity: "A", weight: 0.25, score: 700 }
      ]
    },
    {
      index: 2,
      location: "slavia",
      depth: "ruin3",
      variants: [
        { rarity: "C", weight: 1, score: 85 },
        { rarity: "B", weight: 0.85, score: 300 },
        { rarity: "A", weight: 0.3, score: 800 }
      ]
    }
  ]
};

// Create dig site from variant definition
export function createDigSite(locationId, siteIndex) {
  const variants = DIG_SITE_VARIANTS[locationId];
  if (!variants || siteIndex >= variants.length) {
    return null;
  }
  return variants[siteIndex];
}
