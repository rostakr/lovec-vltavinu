import { GridScene } from "./GridScene.js";

export class ChlumGridScene extends GridScene {
  constructor(options) {
    super({ ...options, levelId: "chlum" });
  }

  async enter() {
    await super.enter();
  }
}
