// Core gameplay mechanics and game design balance

export const DIFFICULTY_SETTINGS = {
  easy: {
    digHitsRequired: 2,
    dangerChance: 0.15,
    scoreMultiplier: 0.8,
    healthRestore: 2,
    timeLimit: 600
  },
  normal: {
    digHitsRequired: 3,
    dangerChance: 0.25,
    scoreMultiplier: 1.0,
    healthRestore: 1,
    timeLimit: 480
  },
  hard: {
    digHitsRequired: 4,
    dangerChance: 0.35,
    scoreMultiplier: 1.5,
    healthRestore: 0.5,
    timeLimit: 360
  }
};

export const LEVEL_DESIGN = {
  chlum: {
    name: "Chlumské pole",
    description: "Průzkum objevu - nový hráč",
    difficulty: "easy",
    digSites: 5,
    objectives: {
      minFindings: 3,
      targetScore: 500
    },
    rewards: {
      completion: 100,
      speedBonus: 50
    }
  },
  nesmen: {
    name: "Nešmenský les",
    description: "Průchodnost a orientace v terénu",
    difficulty: "normal",
    digSites: 8,
    objectives: {
      minFindings: 5,
      targetScore: 1200
    },
    rewards: {
      completion: 200,
      speedBonus: 100
    }
  },
  besednice: {
    name: "Bešednice - lom",
    description: "Strategie kopání - více hlubokých lokalit",
    difficulty: "normal",
    digSites: 6,
    objectives: {
      minFindings: 4,
      targetScore: 1500
    },
    rewards: {
      completion: 250,
      speedBonus: 125
    }
  },
  slavia: {
    name: "Slavie - hrad",
    description: "Finální výzva - práce s dokumetem",
    difficulty: "hard",
    digSites: 10,
    objectives: {
      minFindings: 8,
      targetScore: 3000
    },
    rewards: {
      completion: 500,
      speedBonus: 250
    }
  }
};

export class GameplayMechanics {
  constructor(options = {}) {
    this.difficulty = options.difficulty || "normal";
    this.settings = { ...DIFFICULTY_SETTINGS[this.difficulty] };
    this.logger = options.logger || console;
    this.stats = this.createStats();
  }

  createStats() {
    return {
      digAttempts: 0,
      digSuccesses: 0,
      interactionsCompleted: 0,
      dangerTriggered: 0,
      healthUsed: 0,
      totalScore: 0,
      timeElapsed: 0
    };
  }

  // Calculate dig difficulty (number of hits needed)
  getDigDifficulty(levelId) {
    const levelDef = LEVEL_DESIGN[levelId];
    const baseDifficulty = this.settings.digHitsRequired;

    if (levelDef) {
      if (levelDef.difficulty === "easy") return baseDifficulty - 1;
      if (levelDef.difficulty === "hard") return baseDifficulty + 1;
    }

    return baseDifficulty;
  }

  // Check if dig triggers danger
  checkDangerTrigger() {
    const roll = Math.random();
    return roll < this.settings.dangerChance;
  }

  // Calculate finding score based on rarity
  calculateFindingScore(rarity) {
    const baseScores = { A: 500, B: 200, C: 50 };
    const score = baseScores[rarity] || 0;
    return Math.round(score * this.settings.scoreMultiplier);
  }

  // Calculate completion bonus
  calculateCompletionBonus(levelId, timeElapsed, digCount) {
    const levelDef = LEVEL_DESIGN[levelId];
    if (!levelDef) return 0;

    let bonus = levelDef.rewards.completion;

    // Speed bonus (faster = more points)
    const timeLimit = this.settings.timeLimit;
    if (timeElapsed < timeLimit * 0.5) {
      bonus += levelDef.rewards.speedBonus;
    } else if (timeElapsed < timeLimit * 0.8) {
      bonus += Math.floor(levelDef.rewards.speedBonus * 0.5);
    }

    // Efficiency bonus (more findings with fewer attempts)
    const efficiency = digCount > 0 ? 1 / digCount : 0;
    if (efficiency > 0.5) {
      bonus += Math.floor(efficiency * 100);
    }

    return bonus;
  }

  // Get progression requirement
  getProgressionRequirement(levelId) {
    const def = LEVEL_DESIGN[levelId];
    return def ? def.objectives : { minFindings: 1, targetScore: 100 };
  }

  // Evaluate level completion
  evaluateLevelCompletion(levelId, findings, score, timeElapsed) {
    const requirements = this.getProgressionRequirement(levelId);
    const completed = findings.length >= requirements.minFindings;

    let rating = "fail";
    if (completed) {
      if (score >= requirements.targetScore && timeElapsed < this.settings.timeLimit * 0.7) {
        rating = "excellent";
      } else if (score >= requirements.targetScore * 0.7) {
        rating = "good";
      } else {
        rating = "pass";
      }
    }

    return {
      completed,
      rating,
      requirements,
      actual: {
        findings: findings.length,
        score,
        time: timeElapsed
      }
    };
  }

  // Get difficulty settings
  getDifficultySettings() {
    return { ...this.settings };
  }

  // Set difficulty
  setDifficulty(difficulty) {
    if (!DIFFICULTY_SETTINGS[difficulty]) {
      this.logger.warn(`Unknown difficulty: ${difficulty}`);
      return false;
    }
    this.difficulty = difficulty;
    this.settings = { ...DIFFICULTY_SETTINGS[difficulty] };
    return true;
  }

  // Get level definition
  getLevelDefinition(levelId) {
    return LEVEL_DESIGN[levelId] || null;
  }

  // Get all levels
  getAllLevels() {
    return Object.entries(LEVEL_DESIGN).map(([id, def]) => ({
      id,
      ...def
    }));
  }

  // Calculate total gameplay stats
  getStats() {
    return { ...this.stats };
  }

  // Update stats
  recordDigAttempt(success) {
    this.stats.digAttempts++;
    if (success) this.stats.digSuccesses++;
  }

  recordInteraction() {
    this.stats.interactionsCompleted++;
  }

  recordDanger() {
    this.stats.dangerTriggered++;
  }

  recordScoreGain(amount) {
    this.stats.totalScore += amount;
  }

  recordHealthUsage(amount) {
    this.stats.healthUsed += amount;
  }

  dispose() {
    this.stats = null;
  }
}

// Global instance
export const gameplayMechanics = new GameplayMechanics();
