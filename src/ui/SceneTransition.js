export class SceneTransition {
  constructor(document) {
    this.document = document;
    this.overlay = null;
    this.isTransitioning = false;
  }

  ensureOverlay() {
    if (this.overlay) return this.overlay;

    this.overlay = this.document.createElement("div");
    this.overlay.id = "sceneTransitionOverlay";
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #000;
      opacity: 0;
      pointer-events: none;
      z-index: 999;
      transition: opacity 300ms ease-in-out;
    `;
    this.document.body.appendChild(this.overlay);
    return this.overlay;
  }

  async transitionScene(duration = 300) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const overlay = this.ensureOverlay();
    overlay.style.pointerEvents = "auto";

    overlay.style.opacity = "1";
    await new Promise(resolve => setTimeout(resolve, duration));

    overlay.style.pointerEvents = "none";
    this.isTransitioning = false;
  }

  async fadeOut(duration = 300) {
    const overlay = this.ensureOverlay();
    overlay.style.opacity = "1";
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  async fadeIn(duration = 300) {
    const overlay = this.ensureOverlay();
    overlay.style.opacity = "0";
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  dispose() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
