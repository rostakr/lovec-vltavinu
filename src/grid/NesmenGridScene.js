import { GridScene } from "./GridScene.js";

export class NesmenGridScene extends GridScene {
  constructor(options) {
    super({ ...options, levelId: "nesmen" });
  }

  async enter() {
    await super.enter();
  }
}
