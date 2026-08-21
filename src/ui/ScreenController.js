import { DIG_REQUIRED_HITS } from "../data/levels.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const bindOnce = (element, handler) => {
  element.disabled = false;
  element.setAttribute("aria-disabled", "false");
  element.onclick = event => {
    event.preventDefault();
    handler?.(event);
  };
};

export class ScreenController {
  constructor(document) {
    this.document = document;
    this.app = this.element("app");
    this.hud = this.element("hud");
    this.controls = this.element("controls");
    this.activeId = null;
  }

  element(id) {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing UI element: #${id}`);
    return element;
  }

  show(id, options = {}) {
    for (const screen of this.document.querySelectorAll(".screen")) {
      const active = screen.id === id;
      screen.classList.toggle("visible", active);
      screen.setAttribute("aria-hidden", active ? "false" : "true");
      if ("inert" in screen) screen.inert = !active;
    }

    const screen = id ? this.element(id) : null;
    this.activeId = id;
    const playing = options.playing ?? id === null;
    this.app.classList.toggle("playing", playing);
    this.hud.classList.toggle("hidden", !playing);
    this.controls.classList.toggle("hidden", !playing);
    this.hud.setAttribute("aria-hidden", playing ? "false" : "true");
    this.controls.setAttribute("aria-hidden", playing ? "false" : "true");
    screen?.querySelector?.("button:not([disabled])")?.focus?.({ preventScroll: true });
    return screen;
  }

  showTitle() {
    return this.show("titleScreen", { playing: false });
  }

  showBrief(level, totalLevels, onStart) {
    this.element("briefKicker").textContent = `LOKALITA ${level.order + 1} / ${totalLevels}`;
    this.element("briefTitle").textContent = level.title;
    this.element("briefText").textContent = level.briefing?.context ?? level.text ?? "";
    this.element("briefGoal").textContent = level.briefing?.goal ?? level.goal ?? "";
    const button = this.element("briefButton");
    button.textContent = "JDU NA TO";
    bindOnce(button, onStart);
    return this.show("briefScreen", { playing: false });
  }

  showDialog({ name, text, avatar = "?", buttonLabel = "DOBŘE", onConfirm }) {
    this.element("dialogName").textContent = String(name ?? "").toUpperCase();
    this.element("dialogText").textContent = String(text ?? "");
    this.element("dialogAvatar").textContent = String(avatar ?? "?").slice(0, 2).toUpperCase();
    const button = this.element("dialogButton");
    button.textContent = buttonLabel;
    bindOnce(button, onConfirm);
    return this.show("dialogScreen", { playing: false });
  }

  showDig(options = {}) {
    this.element("digTitle").textContent = options.title ?? "Drž rytmus lopaty";
    const button = this.element("digButton");
    button.textContent = options.buttonLabel ?? "KOPNOUT";
    bindOnce(button, options.onAction);
    this.updateDig(options);
    return this.show("digScreen", { playing: false });
  }

  updateDig(options = {}) {
    const requiredHits = options.requiredHits ?? DIG_REQUIRED_HITS;
    if (requiredHits !== DIG_REQUIRED_HITS) {
      throw new RangeError(`requiredHits must be literal ${DIG_REQUIRED_HITS}.`);
    }

    const hits = Math.max(0, Math.min(DIG_REQUIRED_HITS, Math.trunc(Number(options.hits) || 0)));
    const marker = clamp01(options.marker);
    const sweetMin = clamp01(options.sweetMin ?? 0.4);
    const sweetMax = clamp01(options.sweetMax ?? 0.6);
    if (sweetMin >= sweetMax) throw new RangeError("Dig sweet spot must satisfy sweetMin < sweetMax.");

    this.element("digInfo").textContent = String(options.info ?? "Klepni, když je ukazatel v zeleném poli.");
    const symbols = Array.from({ length: DIG_REQUIRED_HITS }, (_, index) => index < hits ? "◆" : "◇").join(" ");
    const hitSummary = `ZÁSAHY ${hits}/${DIG_REQUIRED_HITS}`;
    const hitsElement = this.element("digHits");
    this.element("digHitCount").textContent = hitSummary;
    this.element("digHitSymbols").textContent = symbols;
    hitsElement.setAttribute("aria-label", `${hitSummary}; ${hits === DIG_REQUIRED_HITS ? "kopání dokončeno" : "drž rytmus pro další zásah"}`);
    this.element("digMarker").style.left = `calc(${marker * 100}% - 5px)`;
    const sweetZone = this.element("sweetZone");
    sweetZone.style.left = `${sweetMin * 100}%`;
    sweetZone.style.width = `${(sweetMax - sweetMin) * 100}%`;
    const button = this.element("digButton");
    button.disabled = Boolean(options.disabled);
    button.setAttribute("aria-label", `${button.textContent}; zásahy ${hits} z ${DIG_REQUIRED_HITS}`);
    button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
  }

  showLevelResult({ kicker = "ÚROVEŇ DOKONČENA", title, text, score = 0, stats = [], buttonLabel = "POKRAČOVAT", onContinue }) {
    const resultScreen = this.element("resultScreen");
    resultScreen.setAttribute("role", "dialog");
    resultScreen.setAttribute("aria-modal", "true");
    resultScreen.setAttribute("aria-labelledby", "resultTitle");
    resultScreen.setAttribute("aria-describedby", "resultText");
    resultScreen.setAttribute("aria-live", "polite");
    resultScreen.setAttribute("aria-busy", "true");

    this.element("resultKicker").textContent = kicker;
    this.element("resultTitle").textContent = String(title ?? "Výprava pokračuje");
    this.element("resultText").textContent = String(text ?? "");
    const normalizedScore = Math.max(0, Number(score) || 0);
    const scoreElement = this.element("resultScore");
    scoreElement.textContent = String(normalizedScore);
    scoreElement.setAttribute("aria-label", `${normalizedScore} bodů`);

    const container = this.element("resultStats");
    container.setAttribute("role", "list");
    container.replaceChildren(...stats.map(stat => {
      const item = this.document.createElement("div");
      item.setAttribute("role", "listitem");
      const label = this.document.createElement("span");
      const value = this.document.createElement("strong");
      label.textContent = String(stat.label ?? "");
      value.textContent = String(stat.value ?? "");
      item.append(label, value);
      return item;
    }));

    const button = this.element("againButton");
    button.textContent = buttonLabel;
    bindOnce(button, onContinue);
    resultScreen.setAttribute("aria-busy", "false");
    return this.show("resultScreen", { playing: false });
  }

  showPause({ onResume, onMenu, placeLabel = "", objective = "", progress = 0 }) {
    const percentage = Math.round(clamp01(progress) * 100);
    this.element("pausePlace").textContent = placeLabel ? `${String(placeLabel).toUpperCase()} · PAUZA` : "PAUZA";
    this.element("pauseObjective").textContent = String(objective || "Výprava čeká na další krok.");
    const progressElement = this.element("pauseProgress");
    progressElement.textContent = `POSTUP ${percentage} %`;
    progressElement.setAttribute("role", "progressbar");
    progressElement.setAttribute("aria-valuemin", "0");
    progressElement.setAttribute("aria-valuemax", "100");
    progressElement.setAttribute("aria-valuenow", String(percentage));
    progressElement.setAttribute("aria-valuetext", `${percentage} %`);
    bindOnce(this.element("resumeButton"), onResume);
    const menu = this.element("menuButton");
    menu.textContent = "ODEJÍT DO MENU";
    bindOnce(menu, onMenu);
    return this.show("pauseScreen", { playing: false });
  }

  showFatal({ title, text, onRetry }) {
    this.element("briefKicker").textContent = "CHYBA SPOUŠTĚNÍ";
    this.element("briefTitle").textContent = title;
    this.element("briefText").textContent = text;
    this.element("briefGoal").textContent = "Obnov stránku a zkus spuštění znovu.";
    const button = this.element("briefButton");
    button.textContent = "OBNOVIT";
    bindOnce(button, onRetry);
    return this.show("briefScreen", { playing: false });
  }

  showFinding({ text = "Nález", icon = "🔑", score = 0 }) {
    const perfectionText = score > 0 ? "" : "";

    this.element("dialogName").textContent = `${icon} NÁLEZ`;
    this.element("dialogText").textContent = `${text}\n+${score} bodů${perfectionText}`;
    this.element("dialogAvatar").textContent = icon;
    const button = this.element("dialogButton");
    button.textContent = "POKRAČOVAT";
    bindOnce(button, () => {});
    return this.show("dialogScreen", { playing: false });
  }

  showDanger(message = "⚠️ Nebezpečí!", onDismiss) {
    this.element("dialogName").textContent = "⚠️ NEBEZPEČÍ";
    this.element("dialogText").textContent = message;
    this.element("dialogAvatar").textContent = "⚠";
    const button = this.element("dialogButton");
    button.textContent = "POCHOPENO";
    bindOnce(button, onDismiss);
    return this.show("dialogScreen", { playing: false });
  }

  play() {
    const activeElement = this.document.activeElement;
    if (activeElement?.closest?.(".screen")) activeElement.blur?.();
    return this.show(null, { playing: true });
  }

  dispose() {
    for (const button of this.document.querySelectorAll("button")) button.onclick = null;
  }
}
