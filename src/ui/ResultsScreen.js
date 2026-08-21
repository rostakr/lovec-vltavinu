// Level results and progression screen

export class ResultsScreen {
  constructor(options = {}) {
    this.document = options.document;
    this.events = options.events;
    this.logger = options.logger || console;
    this.listeners = [];
  }

  // Show level results
  show(levelId, results, onContinue) {
    const screen = this.createResultsScreen(levelId, results);

    const continueBtn = screen.querySelector(".results-continue-btn");
    const retryBtn = screen.querySelector(".results-retry-btn");

    continueBtn.onclick = () => {
      this.close(screen);
      if (onContinue) onContinue("continue");
    };

    retryBtn.onclick = () => {
      this.close(screen);
      if (onContinue) onContinue("retry");
    };

    this.notifyListeners("results-shown", { levelId });
  }

  createResultsScreen(levelId, results) {
    const screen = this.document.createElement("div");
    screen.className = "results-screen";
    screen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5000;
      animation: fadeIn 0.3s ease;
    `;

    const container = this.document.createElement("div");
    container.className = "results-container";
    container.style.cssText = `
      background: #2a2520;
      border: 3px solid #8B7355;
      padding: 30px;
      border-radius: 12px;
      max-width: 500px;
      text-align: center;
      color: #e0d5c8;
      font-family: inherit;
      animation: slideIn 0.4s ease;
    `;

    // Rating
    const ratingEl = this.createRating(results);
    container.appendChild(ratingEl);

    // Stats
    const statsEl = this.createStats(results);
    container.appendChild(statsEl);

    // Score breakdown
    const breakdownEl = this.createScoreBreakdown(results);
    container.appendChild(breakdownEl);

    // Progression info
    const progressionEl = this.createProgressionInfo(levelId, results);
    container.appendChild(progressionEl);

    // Buttons
    const buttonsEl = this.createButtons();
    container.appendChild(buttonsEl);

    screen.appendChild(container);
    this.document.body.appendChild(screen);

    return screen;
  }

  createRating(results) {
    const ratingDiv = this.document.createElement("div");
    ratingDiv.style.cssText = `
      margin-bottom: 20px;
      text-align: center;
    `;

    const ratings = {
      excellent: { emoji: "🌟", text: "VYNIKAJÍCÍ!", color: "#d4af37" },
      good: { emoji: "⭐", text: "SKVĚLÉ!", color: "#90EE90" },
      pass: { emoji: "✓", text: "SPLNĚNO", color: "#87CEEB" },
      fail: { emoji: "✗", text: "SELHÁNÍ", color: "#FF6B6B" }
    };

    const rating = ratings[results.rating] || ratings.fail;

    const emoji = this.document.createElement("div");
    emoji.textContent = rating.emoji;
    emoji.style.cssText = `
      font-size: 48px;
      margin-bottom: 10px;
    `;

    const text = this.document.createElement("h2");
    text.textContent = rating.text;
    text.style.cssText = `
      margin: 0;
      font-size: 32px;
      color: ${rating.color};
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    `;

    ratingDiv.appendChild(emoji);
    ratingDiv.appendChild(text);
    return ratingDiv;
  }

  createStats(results) {
    const statsDiv = this.document.createElement("div");
    statsDiv.style.cssText = `
      background: rgba(139, 115, 85, 0.2);
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    `;

    const stats = [
      { label: "SKÓRE", value: Math.floor(results.totalScore || 0), color: "#d4af37" },
      { label: "NÁLEZY", value: results.findings || 0, color: "#90EE90" },
      { label: "ČAS", value: this.formatTime(results.time || 0), color: "#87CEEB" },
      { label: "EFEKTIVITA", value: this.calculateEfficiency(results), color: "#FFB6C1" }
    ];

    for (const stat of stats) {
      const item = this.document.createElement("div");
      item.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
      `;

      const label = this.document.createElement("span");
      label.textContent = stat.label;
      label.style.cssText = `
        font-size: 11px;
        color: ${stat.color};
        font-weight: bold;
        letter-spacing: 0.5px;
      `;

      const value = this.document.createElement("strong");
      value.textContent = String(stat.value);
      value.style.cssText = `
        font-size: 20px;
        color: ${stat.color};
      `;

      item.appendChild(label);
      item.appendChild(value);
      statsDiv.appendChild(item);
    }

    return statsDiv;
  }

  createScoreBreakdown(results) {
    const breakdownDiv = this.document.createElement("div");
    breakdownDiv.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 12px;
      text-align: left;
    `;

    const breakdown = [
      { label: "Nálezy", value: results.findingsScore || 0 },
      { label: "Bonus za rychlost", value: results.speedBonus || 0 },
      { label: "Bonus za skončení", value: results.completionBonus || 0 },
      { label: "Penalizace za chyby", value: -(results.penalty || 0) }
    ];

    for (const item of breakdown) {
      const row = this.document.createElement("div");
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid rgba(139, 115, 85, 0.3);
      `;

      const label = this.document.createElement("span");
      label.textContent = item.label;

      const value = this.document.createElement("strong");
      value.textContent = item.value > 0 ? `+${item.value}` : `${item.value}`;
      value.style.color = item.value >= 0 ? "#90EE90" : "#FF6B6B";

      row.appendChild(label);
      row.appendChild(value);
      breakdownDiv.appendChild(row);
    }

    return breakdownDiv;
  }

  createProgressionInfo(levelId, results) {
    const progressDiv = this.document.createElement("div");
    progressDiv.style.cssText = `
      background: rgba(212, 175, 55, 0.1);
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 12px;
      border-left: 3px solid #d4af37;
    `;

    if (results.completed) {
      const text = this.document.createElement("p");
      text.textContent = "✓ Úroveň úspěšně dokončena! Postup na další lokaci je otevřen.";
      text.style.cssText = `
        margin: 0;
        color: #90EE90;
      `;
      progressDiv.appendChild(text);
    } else {
      const text = this.document.createElement("p");
      text.textContent = `Potřebuješ alespoň ${results.requirements?.minFindings || 0} nálezů pro postup.`;
      text.style.cssText = `
        margin: 0;
        color: #FFB6C1;
      `;
      progressDiv.appendChild(text);
    }

    return progressDiv;
  }

  createButtons() {
    const buttonsDiv = this.document.createElement("div");
    buttonsDiv.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    const continueBtn = this.document.createElement("button");
    continueBtn.className = "results-continue-btn";
    continueBtn.textContent = "POKRAČOVAT";
    continueBtn.style.cssText = `
      flex: 1;
      padding: 12px;
      background: #8B7355;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    `;

    continueBtn.onmouseover = () => {
      continueBtn.style.background = "#a08560";
    };

    continueBtn.onmouseout = () => {
      continueBtn.style.background = "#8B7355";
    };

    const retryBtn = this.document.createElement("button");
    retryBtn.className = "results-retry-btn";
    retryBtn.textContent = "OPAKOVAT";
    retryBtn.style.cssText = `
      flex: 1;
      padding: 12px;
      background: #6B5B4A;
      color: #e0d5c8;
      border: 1px solid #8B7355;
      border-radius: 4px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    retryBtn.onmouseover = () => {
      retryBtn.style.background = "#8B7355";
    };

    retryBtn.onmouseout = () => {
      retryBtn.style.background = "#6B5B4A";
    };

    buttonsDiv.appendChild(continueBtn);
    buttonsDiv.appendChild(retryBtn);

    return buttonsDiv;
  }

  // Utility functions
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  calculateEfficiency(results) {
    if (!results.findings || results.findings === 0) return "0%";
    const digAttempts = results.digAttempts || results.findings;
    const efficiency = (results.findings / digAttempts) * 100;
    return Math.round(efficiency) + "%";
  }

  close(screen) {
    if (screen) {
      screen.style.animation = "fadeOut 0.3s ease";
      setTimeout(() => {
        screen.remove();
      }, 300);
    }
  }

  // Event system
  onResultsEvent(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(eventType, data) {
    for (const listener of this.listeners) {
      try {
        listener({ type: eventType, ...data });
      } catch (error) {
        this.logger.error(`Results screen listener error: ${error.message}`);
      }
    }
  }

  dispose() {
    this.listeners = [];
  }
}

// Global instance
export const resultsScreen = new ResultsScreen();
