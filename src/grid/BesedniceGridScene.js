import { GridScene } from "./GridScene.js";

export class BesedniceGridScene extends GridScene {
  constructor(options) {
    super({ ...options, levelId: "besednice" });
  }

  async enter() {
    await super.enter();
  }
}
