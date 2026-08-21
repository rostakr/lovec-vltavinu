import { EventBus } from "./EventBus.js";
import { GameLoop } from "./GameLoop.js";
import { SceneManager } from "./SceneManager.js";
import { InputManager } from "./InputManager.js";
import { AssetLoader } from "./AssetLoader.js";
import { World } from "../ecs/World.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { AnimationSystem } from "../systems/AnimationSystem.js";
import { SceneTransition } from "../ui/SceneTransition.js";

export class GameApp {
  constructor(options = {}) {
    this.events = options.events ?? new EventBus();
    this.world = options.world ?? new World();
    this.input = options.input ?? new InputManager({ events: this.events });
    this.assets = options.assets ?? new AssetLoader({ events: this.events });
    this.scenes = options.scenes ?? new SceneManager({ events: this.events });
    this.collisions = options.collisions ?? new CollisionSystem({ events: this.events });
    this.animations = options.animations ?? new AnimationSystem({ events: this.events });
    this.renderer = options.renderer ?? null;
    this.transition = options.transition ?? null;
    this.disposed = false;

    this.loop = options.loop ?? new GameLoop({
      fixedStep: options.fixedStep ?? 1 / 60,
      maxFrameDelta: options.maxFrameDelta ?? 0.1,
      maxSubSteps: options.maxSubSteps ?? 5
    });

    this.removeCoreSystems = [this.loop.addSystem((dt, time) => this.updateFixed(dt, time), 0)];
    this.removeCoreRenderer = this.loop.addRenderer((alpha, metrics) => {
      this.scenes.render(alpha, metrics);
      this.renderer?.render?.(alpha, metrics);
    });
  }

  async boot(initialScene, context = {}) {
    if (this.disposed) throw new Error("Cannot boot a disposed GameApp.");
    this.events.emit("app:boot:start", { initialScene });
    if (initialScene) await this.scenes.transitionTo(initialScene, context);
    this.events.emit("app:boot:complete", { initialScene });
    return this;
  }

  start() {
    if (this.disposed) throw new Error("Cannot start a disposed GameApp.");
    return this.loop.start();
  }

  stop() {
    this.input.reset("app-stop");
    return this.loop.stop();
  }

  async changeScene(id, context = {}) {
    if (this.disposed) throw new Error("Cannot change scene on a disposed GameApp.");
    this.input.reset("scene-transition");
    if (this.transition) {
      await this.transition.fadeOut(300);
      const result = await this.scenes.transitionTo(id, context);
      await this.transition.fadeIn(300);
      return result;
    }
    return this.scenes.transitionTo(id, context);
  }

  updateFixed(dt, time) {
    if (this.scenes.transitioning) {
      this.input.endFrame();
      return;
    }

    const scene = this.scenes.activeScene;
    const input = this.input.snapshot();
    if (!scene) {
      this.input.endFrame();
      return;
    }

    const phases = [
      "beginFixed",
      "updateControl",
      "updateMovement",
      "updateCollisions",
      "updateGameplay",
      "updateObjectives",
      "updateAnimations",
      "updateLifetime",
      "updateHud"
    ];
    const hasPipeline = phases.some(name => typeof scene[name] === "function");
    if (hasPipeline) {
      for (const name of phases) scene[name]?.(dt, time, input);
    } else {
      scene.update?.(dt, time, input);
    }
    this.input.endFrame();
  }

  async dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const remove of this.removeCoreSystems.splice(0)) remove();
    this.removeCoreRenderer?.();
    this.removeCoreRenderer = null;
    await this.scenes.dispose();
    this.input.dispose();
    this.assets.clear(asset => asset?.dispose?.());
    this.world.clear();
    this.collisions.reset();
    this.renderer?.dispose?.();
    this.transition?.dispose?.();
    this.events.emit("app:dispose", {});
    this.events.clear();
  }
}
