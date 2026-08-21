import { ChlumScene } from "./ChlumScene.js";

export class ChlumNesmenBridgeScene extends ChlumScene {
  showResult() {
    this.resultShown = true;
    this.session.setPhase("complete");
    this.levelComplete = Object.freeze({ levelId: "chlum", nextLevelId: "nesmen", score: this.session.state.score });
    this.app.input.reset("chlum-complete");
    this.screens.showLevelResult({
      kicker: "CHLUM DOKONČEN",
      title: "První vltavín je v bezpečí",
      text: "Václavovo povolení platí a nález je připravený pro pokračování do lesní Nesměně.",
      score: this.session.state.score,
      stats: [
        { label: "POVOLENÍ", value: "ANO" },
        { label: "RADAR", value: `${this.radarPulseCount}×` },
        { label: "NÁLEZY", value: this.session.state.findings.length }
      ],
      buttonLabel: "POKRAČOVAT DO NESMĚNĚ",
      onContinue: () => this.app.changeScene("nesmen").catch(error => console.error("Scene transition:", error))
    });
  }

  unloadAssets() {
    for (const entry of this.assetEntries.values()) this.app.assets.unload(entry.id, entry.type);
    this.loadedTextureIds.clear();
    this.loadedModelIds.clear();
    this.loadedModels.clear();
    this.app.assets.unload("chlum-runtime-assets", "json");
  }
}
