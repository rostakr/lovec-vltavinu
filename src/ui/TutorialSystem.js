// Tutorial and onboarding system for new players

export const TUTORIAL_STEPS = {
  welcome: {
    id: "welcome",
    title: "Vítej v Lovci vltavínů",
    content: "Tvůj cíl? Hledat a sbírat vltavíny na různých místech v Česku.",
    action: "Pokračovat",
    highlight: null,
    position: "center"
  },
  movement: {
    id: "movement",
    title: "Pohyb",
    content: "Pohybuj se pomocí šipek nebo WASD. Můžeš se pohybovat osmi směry.",
    action: "Rozumím",
    highlight: ".game-canvas",
    position: "bottom"
  },
  dig: {
    id: "dig",
    title: "Kopání",
    content: "Přiblíž se ke zlatému značení a stiskni SPACE nebo tlačítko AKCE pro kopání.",
    action: "Pokračovat",
    highlight: null,
    position: "center"
  },
  findings: {
    id: "findings",
    title: "Nálezy",
    content: "Každý nález má jinou vzácnost (A = vzácný, B = běžný, C =常). Vzácnější naleziště = více bodů!",
    action: "Výborně",
    highlight: "#findingsValue",
    position: "top"
  },
  objective: {
    id: "objective",
    title: "Cíl úrovně",
    content: "Každá úroveň má svůj cíl. Splň jej a pokročuj dál.",
    action: "Jdu na to",
    highlight: "#objectiveBar",
    position: "top"
  },
  npcs: {
    id: "npcs",
    title: "Setkávání s NPCs",
    content: "Potkáš farmáře, myslivce a další. Jejich dialog ti dá tipy na nalezení vltavínů.",
    action: "Pokračovat",
    highlight: null,
    position: "center"
  },
  score: {
    id: "score",
    title: "Skóre",
    content: "Shromažďuj body za naleziště a jejich vzácnost. Vysoké skóre = přístup na další úrovně!",
    action: "Rozumím",
    highlight: "#scoreValue",
    position: "top"
  },
  ready: {
    id: "ready",
    title: "Jsi připraven!",
    content: "Nyní jsi připraven začít. Hledej moudře a vítězit stále!",
    action: "Začít hru",
    highlight: null,
    position: "center"
  }
};

export class TutorialSystem {
  constructor(options = {}) {
    this.document = options.document;
    this.logger = options.logger || console;
    this.storageAdapter = options.storageAdapter || null;
    this.currentStep = null;
    this.completedSteps = new Set();
    this.isEnabled = options.enabled !== false;
    this.listeners = [];
    this.modal = null;
    this.overlay = null;
    this.loadProgress();
  }

  loadProgress() {
    try {
      if (this.storageAdapter) {
        const saved = this.storageAdapter.load();
        if (saved && Array.isArray(saved)) {
          this.completedSteps = new Set(saved);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to load tutorial progress: ${error.message}`);
    }
  }

  saveProgress() {
    try {
      if (this.storageAdapter) {
        this.storageAdapter.save(Array.from(this.completedSteps));
      }
    } catch (error) {
      this.logger.error(`Failed to save tutorial progress: ${error.message}`);
    }
  }

  // Start tutorial from beginning
  startTutorial(onComplete) {
    if (!this.isEnabled) return;

    this.completedSteps.clear();
    this.saveProgress();
    this.showStep("welcome", onComplete);
  }

  // Show specific tutorial step
  showStep(stepId, onComplete) {
    const step = TUTORIAL_STEPS[stepId];
    if (!step) {
      this.logger.warn(`Unknown tutorial step: ${stepId}`);
      return;
    }

    this.currentStep = stepId;
    this.createModal(step, () => {
      this.completeStep(stepId);

      // Find next step
      const stepIds = Object.keys(TUTORIAL_STEPS);
      const currentIndex = stepIds.indexOf(stepId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < stepIds.length) {
        const nextStepId = stepIds[nextIndex];
        if (!this.completedSteps.has(nextStepId)) {
          this.showStep(nextStepId, onComplete);
        }
      } else {
        if (onComplete) onComplete();
      }
    });
  }

  // Create modal overlay
  createModal(step, onClose) {
    this.closeModal();

    // Overlay
    this.overlay = this.document.createElement("div");
    this.overlay.className = "tutorial-overlay";
    this.overlay.style.position = "fixed";
    this.overlay.style.top = "0";
    this.overlay.style.left = "0";
    this.overlay.style.width = "100%";
    this.overlay.style.height = "100%";
    this.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.overlay.style.zIndex = "9999";

    // Modal
    this.modal = this.document.createElement("div");
    this.modal.className = `tutorial-modal tutorial-${step.position}`;
    this.modal.style.position = "fixed";
    this.modal.style.backgroundColor = "#2a2520";
    this.modal.style.padding = "20px";
    this.modal.style.borderRadius = "8px";
    this.modal.style.maxWidth = "400px";
    this.modal.style.color = "#e0d5c8";
    this.modal.style.fontFamily = "inherit";
    this.modal.style.zIndex = "10000";
    this.modal.style.border = "2px solid #8B7355";
    this.modal.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.8)";

    if (step.position === "center") {
      this.modal.style.top = "50%";
      this.modal.style.left = "50%";
      this.modal.style.transform = "translate(-50%, -50%)";
    } else if (step.position === "top") {
      this.modal.style.top = "100px";
      this.modal.style.left = "50%";
      this.modal.style.transform = "translateX(-50%)";
    } else if (step.position === "bottom") {
      this.modal.style.bottom = "100px";
      this.modal.style.left = "50%";
      this.modal.style.transform = "translateX(-50%)";
    }

    // Title
    const title = this.document.createElement("h3");
    title.textContent = step.title;
    title.style.marginTop = "0";
    title.style.marginBottom = "12px";
    title.style.fontSize = "18px";
    title.style.fontWeight = "bold";
    title.style.color = "#d4af37";

    // Content
    const content = this.document.createElement("p");
    content.textContent = step.content;
    content.style.margin = "0 0 16px 0";
    content.style.lineHeight = "1.5";

    // Button
    const button = this.document.createElement("button");
    button.textContent = step.action;
    button.className = "tutorial-button";
    button.style.display = "block";
    button.style.width = "100%";
    button.style.padding = "10px";
    button.style.backgroundColor = "#8B7355";
    button.style.color = "#fff";
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
    button.style.fontWeight = "bold";
    button.style.transition = "background-color 0.2s";

    button.onmouseover = () => {
      button.style.backgroundColor = "#a08560";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#8B7355";
    };

    button.onclick = () => {
      this.closeModal();
      if (onClose) onClose();
    };

    this.modal.appendChild(title);
    this.modal.appendChild(content);
    this.modal.appendChild(button);

    // Highlight element if specified
    if (step.highlight) {
      const element = this.document.querySelector(step.highlight);
      if (element) {
        const rect = element.getBoundingClientRect();
        const highlight = this.document.createElement("div");
        highlight.style.position = "fixed";
        highlight.style.top = `${rect.top - 4}px`;
        highlight.style.left = `${rect.left - 4}px`;
        highlight.style.width = `${rect.width + 8}px`;
        highlight.style.height = `${rect.height + 8}px`;
        highlight.style.border = "3px solid #d4af37";
        highlight.style.borderRadius = "4px";
        highlight.style.pointerEvents = "none";
        highlight.style.zIndex = "9998";
        highlight.style.boxShadow = "0 0 20px rgba(212, 175, 55, 0.5)";
        this.overlay.appendChild(highlight);
      }
    }

    this.document.body.appendChild(this.overlay);
    this.document.body.appendChild(this.modal);

    this.notifyListeners("step-shown", { stepId: step.id });
  }

  // Close modal
  closeModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  // Mark step as completed
  completeStep(stepId) {
    this.completedSteps.add(stepId);
    this.saveProgress();
    this.notifyListeners("step-completed", { stepId });
  }

  // Check if tutorial is complete
  isComplete() {
    return this.completedSteps.size === Object.keys(TUTORIAL_STEPS).length;
  }

  // Skip tutorial
  skipTutorial() {
    for (const stepId of Object.keys(TUTORIAL_STEPS)) {
      this.completedSteps.add(stepId);
    }
    this.saveProgress();
    this.closeModal();
  }

  // Show hint for current state
  showHint(hintText, duration = 3000) {
    const hint = this.document.createElement("div");
    hint.className = "tutorial-hint";
    hint.textContent = hintText;
    hint.style.position = "fixed";
    hint.style.bottom = "100px";
    hint.style.left = "50%";
    hint.style.transform = "translateX(-50%)";
    hint.style.backgroundColor = "#8B7355";
    hint.style.color = "#fff";
    hint.style.padding = "10px 20px";
    hint.style.borderRadius = "4px";
    hint.style.fontSize = "14px";
    hint.style.zIndex = "9000";
    hint.style.animation = "fadeInOut 3s ease-in-out";

    this.document.body.appendChild(hint);

    setTimeout(() => {
      hint.remove();
    }, duration);
  }

  // Event system
  onTutorialEvent(listener) {
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
        this.logger.error(`Tutorial listener error: ${error.message}`);
      }
    }
  }

  // Get completion percentage
  getCompletionPercent() {
    const total = Object.keys(TUTORIAL_STEPS).length;
    return Math.round((this.completedSteps.size / total) * 100);
  }

  dispose() {
    this.closeModal();
    this.listeners = [];
  }
}

// Global instance - will be initialized with storage adapter in bootstrap
export const tutorialSystem = new TutorialSystem();
