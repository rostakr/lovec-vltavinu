// Enhanced game status and progress display

export class GameStatusDisplay {
  constructor(options = {}) {
    this.document = options.document;
    this.logger = options.logger || console;
    this.elements = {};
    this.isVisible = false;
    this.createStatusPanel();
  }

  createStatusPanel() {
    const container = this.document.getElementById("game-status") || this.createContainer();

    // Score display
    this.elements.scoreLabel = this.createElement("div", "status-item score-item");
    this.elements.scoreLabel.innerHTML = `<span class="label">SKÓRE</span><strong id="scoreValue">0</strong>`;

    // Health display
    this.elements.healthLabel = this.createElement("div", "status-item health-item");
    this.elements.healthLabel.innerHTML = `<span class="label">ŽIVOTŮ</span><div id="healthBar" class="health-bar"></div>`;

    // Time display
    this.elements.timeLabel = this.createElement("div", "status-item time-item");
    this.elements.timeLabel.innerHTML = `<span class="label">ČAS</span><strong id="timeValue">00:00</strong>`;

    // Findings display
    this.elements.findingsLabel = this.createElement("div", "status-item findings-item");
    this.elements.findingsLabel.innerHTML = `<span class="label">NÁLEZY</span><strong id="findingsValue">0</strong>`;

    // Objective display
    this.elements.objectiveLabel = this.createElement("div", "status-item objective-item");
    this.elements.objectiveLabel.innerHTML = `
      <span class="label">CÍLE</span>
      <div id="objectiveBar" class="objective-bar">
        <div id="objectiveFill" class="objective-fill"></div>
      </div>
      <span id="objectiveProgress" class="progress-text">0/0</span>
    `;

    // Mini-map placeholder
    this.elements.minimapLabel = this.createElement("div", "status-item minimap-item");
    this.elements.minimapLabel.innerHTML = `
      <span class="label">MAPA</span>
      <div id="minimap" class="minimap"></div>
    `;

    container.appendChild(this.elements.scoreLabel);
    container.appendChild(this.elements.healthLabel);
    container.appendChild(this.elements.timeLabel);
    container.appendChild(this.elements.findingsLabel);
    container.appendChild(this.elements.objectiveLabel);
    container.appendChild(this.elements.minimapLabel);

    this.container = container;
  }

  createContainer() {
    const container = this.document.createElement("div");
    container.id = "game-status";
    container.className = "game-status-panel";
    this.document.body.appendChild(container);
    return container;
  }

  createElement(tag, className) {
    const el = this.document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  // Update score display
  updateScore(score) {
    const scoreEl = this.document.getElementById("scoreValue");
    if (scoreEl) {
      scoreEl.textContent = Math.floor(score).toString();
      this.animateChange(scoreEl);
    }
  }

  // Update health display
  updateHealth(current, max) {
    const healthBar = this.document.getElementById("healthBar");
    if (healthBar) {
      const percentage = Math.max(0, (current / max) * 100);
      healthBar.innerHTML = "";

      for (let i = 0; i < max; i++) {
        const heart = this.document.createElement("div");
        heart.className = "health-heart";
        if (i < current) {
          heart.classList.add("full");
        }
        healthBar.appendChild(heart);
      }
    }
  }

  // Update time display
  updateTime(seconds) {
    const timeEl = this.document.getElementById("timeValue");
    if (timeEl) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
  }

  // Update findings count
  updateFindings(count) {
    const findingsEl = this.document.getElementById("findingsValue");
    if (findingsEl) {
      findingsEl.textContent = count.toString();
      if (count > 0) {
        this.animateChange(findingsEl);
      }
    }
  }

  // Update objective progress
  updateObjective(current, required) {
    const fill = this.document.getElementById("objectiveFill");
    const progress = this.document.getElementById("objectiveProgress");

    if (fill) {
      const percentage = required > 0 ? (current / required) * 100 : 0;
      fill.style.width = `${percentage}%`;
    }

    if (progress) {
      progress.textContent = `${current}/${required}`;
    }
  }

  // Animate element change
  animateChange(element) {
    element.classList.add("changed");
    setTimeout(() => {
      element.classList.remove("changed");
    }, 500);
  }

  // Show status panel
  show() {
    if (this.container) {
      this.container.classList.add("visible");
      this.isVisible = true;
    }
  }

  // Hide status panel
  hide() {
    if (this.container) {
      this.container.classList.remove("visible");
      this.isVisible = false;
    }
  }

  // Toggle visibility
  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  // Create mini-map
  createMinimap(grid, playerX, playerY) {
    const minimap = this.document.getElementById("minimap");
    if (!minimap) return;

    minimap.innerHTML = "";
    const canvas = this.document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    canvas.className = "minimap-canvas";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    const scaleX = canvas.width / (grid.width || 1);
    const scaleY = canvas.height / (grid.height || 1);

    ctx.fillStyle = "#4a4040";
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.isWalkable(x, y)) {
          ctx.fillStyle = "#6a5a50";
          ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
        }
      }
    }

    // Draw dig sites
    for (const { gridX, gridY } of grid.digSites?.values?.() || []) {
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(gridX * scaleX, gridY * scaleY, scaleX, scaleY);
    }

    // Draw player
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc((playerX + 0.5) * scaleX, (playerY + 0.5) * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();

    minimap.appendChild(canvas);
  }

  // Get full status
  getStatus() {
    return {
      score: this.document.getElementById("scoreValue")?.textContent || "0",
      time: this.document.getElementById("timeValue")?.textContent || "00:00",
      findings: this.document.getElementById("findingsValue")?.textContent || "0",
      objective: this.document.getElementById("objectiveProgress")?.textContent || "0/0"
    };
  }

  dispose() {
    if (this.container) {
      this.container.remove();
    }
    this.elements = {};
  }
}
