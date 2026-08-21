// Level progression and unlock system

export const LEVEL_SEQUENCE = [
  { id: "chlum", name: "Chlum", unlockScore: 0, requiredScore: 500, minFindings: 3 },
  { id: "nesmen", name: "Nešmen", unlockScore: 500, requiredScore: 1200, minFindings: 5 },
  { id: "besednice", name: "Bešednice", unlockScore: 1700, requiredScore: 1500, minFindings: 4 },
  { id: "slavia", name: "Slavia", unlockScore: 3200, requiredScore: 3000, minFindings: 8 }
];

export class LevelProgression {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.storageAdapter = options.storageAdapter || null;
    this.progress = this.loadProgress();
  }

  loadProgress() {
    try {
      if (this.storageAdapter) {
        const data = this.storageAdapter.load();
        if (data) {
          return data;
        }
      }
      return this.createDefaultProgress();
    } catch (error) {
      this.logger.warn(`Failed to load level progress: ${error.message}`);
      return this.createDefaultProgress();
    }
  }

  createDefaultProgress() {
    return {
      currentLevel: "chlum",
      completedLevels: [],
      highestUnlockedLevel: "chlum",
      levelStats: {},
      totalScore: 0,
      totalFindings: 0,
      createdAt: Date.now()
    };
  }

  saveProgress() {
    try {
      if (this.storageAdapter) {
        this.storageAdapter.save(this.progress);
      }
    } catch (error) {
      this.logger.error(`Failed to save level progress: ${error.message}`);
    }
  }

  // Record level completion
  completeLevelId(levelId, score, findings) {
    const level = LEVEL_SEQUENCE.find(l => l.id === levelId);
    if (!level) return false;

    if (!this.progress.levelStats[levelId]) {
      this.progress.levelStats[levelId] = {
        completed: false,
        attempts: 0,
        bestScore: 0,
        totalFindings: 0
      };
    }

    const stats = this.progress.levelStats[levelId];
    stats.attempts++;
    stats.bestScore = Math.max(stats.bestScore, score);
    stats.totalFindings = Math.max(stats.totalFindings, findings);

    // Mark as completed if requirements met
    if (score >= level.requiredScore && findings >= level.minFindings) {
      stats.completed = true;
      if (!this.progress.completedLevels.includes(levelId)) {
        this.progress.completedLevels.push(levelId);
      }

      // Unlock next level
      const levelIndex = LEVEL_SEQUENCE.findIndex(l => l.id === levelId);
      if (levelIndex < LEVEL_SEQUENCE.length - 1) {
        const nextLevel = LEVEL_SEQUENCE[levelIndex + 1];
        this.progress.highestUnlockedLevel = nextLevel.id;
      }
    }

    // Update totals
    this.progress.totalScore += score;
    this.progress.totalFindings += findings;
    this.saveProgress();

    return stats.completed;
  }

  // Check if level is unlocked
  isLevelUnlocked(levelId) {
    const unlockedIndex = LEVEL_SEQUENCE.findIndex(l => l.id === this.progress.highestUnlockedLevel);
    const levelIndex = LEVEL_SEQUENCE.findIndex(l => l.id === levelId);
    return levelIndex <= unlockedIndex;
  }

  // Get level info
  getLevelInfo(levelId) {
    const level = LEVEL_SEQUENCE.find(l => l.id === levelId);
    if (!level) return null;

    return {
      ...level,
      unlocked: this.isLevelUnlocked(levelId),
      completed: this.progress.completedLevels.includes(levelId),
      stats: this.progress.levelStats[levelId] || null
    };
  }

  // Get next recommended level
  getNextLevel() {
    const unlockedLevels = LEVEL_SEQUENCE.filter(l => this.isLevelUnlocked(l.id));
    if (unlockedLevels.length === 0) return LEVEL_SEQUENCE[0];

    // Find first incomplete level
    const nextIncomplete = unlockedLevels.find(l => !this.progress.completedLevels.includes(l.id));
    return nextIncomplete || unlockedLevels[unlockedLevels.length - 1];
  }

  // Get all levels with unlock status
  getAllLevels() {
    return LEVEL_SEQUENCE.map(level => ({
      ...level,
      unlocked: this.isLevelUnlocked(level.id),
      completed: this.progress.completedLevels.includes(level.id),
      stats: this.progress.levelStats[level.id] || { attempts: 0, bestScore: 0, totalFindings: 0 }
    }));
  }

  // Get completion percentage
  getCompletionPercent() {
    return Math.round((this.progress.completedLevels.length / LEVEL_SEQUENCE.length) * 100);
  }

  // Get progress summary
  getSummary() {
    return {
      currentLevel: this.progress.currentLevel,
      completedLevels: this.progress.completedLevels.length,
      totalLevels: LEVEL_SEQUENCE.length,
      completionPercent: this.getCompletionPercent(),
      totalScore: this.progress.totalScore,
      totalFindings: this.progress.totalFindings,
      highestUnlockedLevel: this.progress.highestUnlockedLevel,
      timePlayingMs: Date.now() - this.progress.createdAt
    };
  }

  // Get level requirements
  getLevelRequirements(levelId) {
    const level = LEVEL_SEQUENCE.find(l => l.id === levelId);
    if (!level) return null;

    return {
      minFindings: level.minFindings,
      targetScore: level.requiredScore,
      progressToUnlock: level.unlockScore
    };
  }

  // Reset progression (for testing)
  reset() {
    this.progress = this.createDefaultProgress();
    this.saveProgress();
  }

  dispose() {
    this.progress = null;
  }
}

// Global instance - will be initialized with storage adapter in bootstrap
export const levelProgression = new LevelProgression();
