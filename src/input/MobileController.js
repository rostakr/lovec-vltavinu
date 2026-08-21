// Mobile touch controls for better mobile experience

export class MobileController {
  constructor(options = {}) {
    this.document = options.document;
    this.window = options.window;
    this.inputManager = options.inputManager;
    this.logger = options.logger || console;
    this.isMobile = this.detectMobile();
    this.isEnabled = options.enabled !== false && this.isMobile;
    this.touchState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };
    this.listeners = [];

    if (this.isEnabled) {
      this.createMobileControls();
      this.installTouchListeners();
    }
  }

  detectMobile() {
    const userAgent = this.window.navigator.userAgent || "";
    const mobilePatterns = [/Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i, /BlackBerry/i, /Windows Phone/i];
    return mobilePatterns.some(pattern => pattern.test(userAgent));
  }

  createMobileControls() {
    const container = this.document.createElement("div");
    container.id = "mobile-controls";
    container.className = "touch-controls active";

    // D-Pad
    const dpad = this.document.createElement("div");
    dpad.className = "touch-dpad";

    const directions = [
      { class: "dpad-up", symbol: "▲", action: () => this.handleDpadPress("up") },
      { class: "dpad-left", symbol: "◄", action: () => this.handleDpadPress("left") },
      { class: "dpad-center", symbol: "", action: null },
      { class: "dpad-right", symbol: "►", action: () => this.handleDpadPress("right") },
      { class: "dpad-down", symbol: "▼", action: () => this.handleDpadPress("down") }
    ];

    for (const dir of directions) {
      if (dir.action) {
        const button = this.document.createElement("button");
        button.className = `dpad-button ${dir.class}`;
        button.textContent = dir.symbol;
        button.ontouchstart = (e) => {
          e.preventDefault();
          dir.action();
        };
        button.onmousedown = dir.action;
        dpad.appendChild(button);
      } else {
        const center = this.document.createElement("div");
        center.className = `dpad-button ${dir.class}`;
        dpad.appendChild(center);
      }
    }

    // Action buttons
    const buttons = this.document.createElement("div");
    buttons.className = "touch-buttons";

    const actionBtn = this.document.createElement("button");
    actionBtn.className = "touch-button";
    actionBtn.textContent = "AKCE";
    actionBtn.ontouchstart = (e) => {
      e.preventDefault();
      this.handleActionPress();
    };
    actionBtn.onmousedown = () => this.handleActionPress();

    const pauseBtn = this.document.createElement("button");
    pauseBtn.className = "touch-button danger";
    pauseBtn.textContent = "PAUZA";
    pauseBtn.ontouchstart = (e) => {
      e.preventDefault();
      this.handlePausePress();
    };
    pauseBtn.onmousedown = () => this.handlePausePress();

    buttons.appendChild(actionBtn);
    buttons.appendChild(pauseBtn);

    container.appendChild(dpad);
    container.appendChild(buttons);

    this.document.body.appendChild(container);
    this.controlsContainer = container;
  }

  installTouchListeners() {
    if (!this.inputManager) return;

    const canvas = this.document.getElementById("game");
    if (!canvas) return;

    // Swipe gestures for alternative input
    canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), false);
    canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), false);
    canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), false);

    // Prevent default touch behaviors
    canvas.addEventListener("gesturestart", (e) => e.preventDefault(), false);
  }

  handleTouchStart(e) {
    const touch = e.touches[0];
    this.touchState.isDragging = true;
    this.touchState.startX = touch.clientX;
    this.touchState.startY = touch.clientY;
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
  }

  handleTouchMove(e) {
    if (!this.touchState.isDragging) return;

    const touch = e.touches[0];
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;

    const dx = this.touchState.currentX - this.touchState.startX;
    const dy = this.touchState.currentY - this.touchState.startY;
    const threshold = 30;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      this.handleSwipe(dx, dy);
      this.touchState.isDragging = false;
    }
  }

  handleTouchEnd(e) {
    this.touchState.isDragging = false;
  }

  handleSwipe(dx, dy) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      // Horizontal swipe
      if (dx > 0) {
        this.handleDpadPress("right");
      } else {
        this.handleDpadPress("left");
      }
    } else {
      // Vertical swipe
      if (dy > 0) {
        this.handleDpadPress("down");
      } else {
        this.handleDpadPress("up");
      }
    }
  }

  handleDpadPress(direction) {
    if (!this.inputManager) return;

    const moves = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    };

    const move = moves[direction];
    if (move) {
      this.inputManager.setAxis("move", move);
      this.notifyListeners("dpad-press", { direction });
    }
  }

  handleActionPress() {
    if (!this.inputManager) return;

    this.inputManager.setAction("action", true);
    setTimeout(() => {
      this.inputManager.setAction("action", false);
    }, 100);

    this.notifyListeners("action-press", {});
  }

  handlePausePress() {
    if (!this.inputManager) return;

    this.inputManager.setAction("pause", true);
    setTimeout(() => {
      this.inputManager.setAction("pause", false);
    }, 100);

    this.notifyListeners("pause-press", {});
  }

  // Enable/disable controls
  enable() {
    if (this.controlsContainer) {
      this.controlsContainer.classList.add("active");
    }
  }

  disable() {
    if (this.controlsContainer) {
      this.controlsContainer.classList.remove("active");
    }
  }

  // Show/hide controls
  show() {
    if (this.controlsContainer) {
      this.controlsContainer.style.display = "flex";
    }
  }

  hide() {
    if (this.controlsContainer) {
      this.controlsContainer.style.display = "none";
    }
  }

  // Check device orientation
  getOrientation() {
    if (this.window.innerHeight > this.window.innerWidth) {
      return "portrait";
    } else {
      return "landscape";
    }
  }

  // Handle orientation change
  onOrientationChange(callback) {
    this.window.addEventListener("orientationchange", () => {
      const orientation = this.getOrientation();
      callback(orientation);
    });
  }

  // Get mobile device info
  getDeviceInfo() {
    return {
      isMobile: this.isMobile,
      orientation: this.getOrientation(),
      userAgent: this.window.navigator.userAgent,
      width: this.window.innerWidth,
      height: this.window.innerHeight,
      pixelRatio: this.window.devicePixelRatio
    };
  }

  // Event system
  onMobileEvent(listener) {
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
        this.logger.error(`Mobile controller listener error: ${error.message}`);
      }
    }
  }

  dispose() {
    if (this.controlsContainer) {
      this.controlsContainer.remove();
    }
    this.listeners = [];
  }
}
