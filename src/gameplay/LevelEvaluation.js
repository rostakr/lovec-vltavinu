// Comprehensive level evaluation and scoring

import { evaluateObjective } from "./Objectives.js";

export class LevelEvaluation {
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  // Evaluate complete level performance
  evaluateLevel(levelId, gameState = {}) {
    const objective = evaluateObjective(levelId, gameState);

    const findings = gameState.findings || [];
    const score = gameState.score || 0;
    const timeSeconds = gameState.timeSeconds || 0;
    const dangers = gameState.dangerCount || 0;
    const digSites = gameState.digSitesVisited || 0;

    // Calculate rating
    const rating = this.calculateRating(levelId, {
      objectiveComplete: objective.complete,
      score,
      findings: findings.length,
      dangers,
      timeSeconds
    });

    // Calculate bonuses
    const completionBonus = objective.complete ? 200 : 0;
    const speedBonus = this.calculateSpeedBonus(levelId, timeSeconds);
    const perfectionBonus = dangers === 0 ? 100 : 0;

    const totalScore = score + completionBonus + speedBonus + perfectionBonus;

    return {
      levelId,
      levelName: objective.levelName,
      objective,
      rating,
      findings: findings.length,
      findingDetails: this.summarizeFindings(findings),
      score: {
        findings: score,
        completion: completionBonus,
        speed: speedBonus,
        perfection: perfectionBonus,
        total: totalScore
      },
      stats: {
        timeSeconds,
        timeDisplay: this.formatTime(timeSeconds),
        digSites,
        dangers,
        perfectHits: this.countPerfectHits(gameState),
        uniqueRarities: this.countUniqueRarities(findings)
      },
      performance: this.getPerformanceNotes(levelId, gameState),
      progression: this.getProgression(levelId, totalScore)
    };
  }

  // Calculate rating (Excellent/Good/Pass/Fail)
  calculateRating(levelId, metrics) {
    if (!metrics.objectiveComplete) {
      return { level: "SELHÁNÍ", icon: "✗", color: "#FF6B6B" };
    }

    const scoreThresholds = {
      chlum: { excellent: 1000, good: 600, pass: 300 },
      nesmen: { excellent: 1800, good: 1200, pass: 600 },
      besednice: { excellent: 2500, good: 1500, pass: 800 },
      slavia: { excellent: 3500, good: 2000, pass: 1200 }
    };

    const threshold = scoreThresholds[levelId] || { excellent: 2000, good: 1200, pass: 600 };

    if (metrics.score >= threshold.excellent && metrics.dangers === 0) {
      return { level: "VYNIKAJÍCÍ", icon: "⭐⭐⭐", color: "#FFD700" };
    } else if (metrics.score >= threshold.good && metrics.dangers <= 1) {
      return { level: "SKVĚLÝ", icon: "⭐⭐", color: "#87CEEB" };
    } else if (metrics.score >= threshold.pass) {
      return { level: "ÚSPĚCH", icon: "⭐", color: "#90EE90" };
    }

    return { level: "UPLYNULO", icon: "✓", color: "#FFD700" };
  }

  // Calculate speed bonus based on level timing
  calculateSpeedBonus(levelId, timeSeconds) {
    const timeLimits = {
      chlum: { fast: 120, medium: 300, slow: 600 },
      nesmen: { fast: 180, medium: 450, slow: 900 },
      besednice: { fast: 240, medium: 600, slow: 1200 },
      slavia: { fast: 300, medium: 750, slow: 1500 }
    };

    const limit = timeLimits[levelId] || { fast: 300, medium: 600, slow: 1200 };

    if (timeSeconds <= limit.fast) return 250;
    if (timeSeconds <= limit.medium) return 150;
    if (timeSeconds <= limit.slow) return 50;
    return 0;
  }

  // Count findings by rarity
  summarizeFindings(findings) {
    const summary = { A: 0, B: 0, C: 0 };

    for (const finding of findings) {
      if (finding.rarity in summary) {
        summary[finding.rarity]++;
      }
    }

    return {
      total: findings.length,
      byRarity: summary,
      display: `💎${summary.A} ⭐${summary.B} 🔑${summary.C}`
    };
  }

  // Count perfect hits (clean excavations)
  countPerfectHits(gameState) {
    return gameState.perfectDigs || 0;
  }

  // Count unique rarities found
  countUniqueRarities(findings) {
    const rarities = new Set(findings.map(f => f.rarity));
    return rarities.size;
  }

  // Format time for display
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Get performance notes and feedback
  getPerformanceNotes(levelId, gameState) {
    const notes = [];

    const findings = gameState.findings || [];
    if (findings.length === 0) {
      notes.push("Zkus vykopat více. Hledej vyznačená místa!");
    }

    const dangers = gameState.dangerCount || 0;
    if (dangers === 0) {
      notes.push("⭐ Perfektní! Vyhnul/a jsi se všem nebezpečím!");
    } else if (dangers > 3) {
      notes.push("Buď opatrněji. Příliš mnoho nebezpečí!");
    }

    const timeSeconds = gameState.timeSeconds || 0;
    if (timeSeconds > 1000) {
      notes.push("Příště zkus to udělat rychleji.");
    }

    if (gameState.objectiveComplete) {
      notes.push("✓ Splnil/a jsi všechny cíle!");
    }

    return notes;
  }

  // Get progression info (next level unlock, etc)
  getProgression(levelId, totalScore) {
    const progressionReqs = {
      chlum: { nextLevel: "nesmen", requiredScore: 800 },
      nesmen: { nextLevel: "besednice", requiredScore: 1500 },
      besednice: { nextLevel: "slavia", requiredScore: 2200 },
      slavia: { nextLevel: null, requiredScore: null }
    };

    const prog = progressionReqs[levelId];

    if (!prog || !prog.nextLevel) {
      return {
        message: "Dosáhl jsi konce hry! Gratulace!",
        progress: 100
      };
    }

    const scoreProgress = Math.min(100, Math.round((totalScore / prog.requiredScore) * 100));

    return {
      nextLevel: prog.nextLevel,
      requiredScore: prog.requiredScore,
      currentScore: totalScore,
      progress: scoreProgress,
      message: totalScore >= prog.requiredScore
        ? `✓ Odblokovan: ${prog.nextLevel}!`
        : `Potřebuješ ${prog.requiredScore - totalScore} bodů pro další úroveň.`
    };
  }

  // Generate full result screen content
  generateResultScreen(levelId, gameState) {
    const evaluation = this.evaluateLevel(levelId, gameState);

    return {
      kicker: evaluation.rating.level,
      title: evaluation.levelName,
      icon: evaluation.rating.icon,
      text: evaluation.performance.join("\n"),
      score: evaluation.score.total,
      stats: [
        { label: "Naleziště", value: evaluation.findingDetails.display },
        { label: "Čas", value: evaluation.stats.timeDisplay },
        { label: "Nebezpečí", value: `${evaluation.stats.dangers}x` },
        { label: "Skóre detaily", value: `${evaluation.score.findings} + ${evaluation.score.completion} + ${evaluation.score.speed} + ${evaluation.score.perfection}` }
      ],
      progression: evaluation.progression,
      evaluation
    };
  }
}

export const levelEvaluation = new LevelEvaluation();
