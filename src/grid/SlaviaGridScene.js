import { GridScene } from "./GridScene.js";

export class SlaviaGridScene extends GridScene {
  constructor(options) {
    super({ ...options, levelId: "slavia" });
  }

  async enter() {
    await super.enter();
  }
}
