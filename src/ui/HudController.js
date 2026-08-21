const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const fingerprint = (revision, model) => `${revision}:${JSON.stringify(model ?? {})}`;

function radarPresentation(model) {
  const hint = String(model?.hint ?? "");
  const normalized = hint.toLocaleLowerCase("cs-CZ");
  const active = String(model?.actionLabel ?? "").toUpperCase() === "RADAR" || normalized.includes("radar");
  if (!active) return { visible: false, signal: "off", strength: 0, label: "VYPNUTO" };
  if (normalized.includes("odhalil")) return { visible: true, signal: "target", strength: 1, label: "CÍL" };
  if (normalized.includes("silný")) return { visible: true, signal: "strong", strength: 0.82, label: "SILNÝ" };
  if (normalized.includes("slabý")) return { visible: true, signal: "weak", strength: 0.48, label: "SLABÝ" };
  if (normalized.includes("bez signálu")) return { visible: true, signal: "none", strength: 0.14, label: "MIMO" };
  return { visible: true, signal: "ready", strength: 0.28, label: "HLEDÁM" };
}

export class HudController {
  constructor(options) {
    this.document = options.document;
    this.events = options.events;
    this.revision = -1;
    this.lastFingerprint = "";
    const radar = this.ensureRadarPanel();
    this.elements = {
      app: this.require("app"),
      hud: this.require("hud"),
      missionNumber: this.require("missionNumber"),
      placeLabel: this.require("placeLabel"),
      objectiveLabel: this.require("objectiveLabel"),
      objectiveProgress: this.require("objectiveProgress"),
      bagValue: this.require("bagValue"),
      dangerMeter: this.require("heatPill"),
      dangerMeterText: this.require("dangerMeterText"),
      dangerFill: this.require("heatFill"),
      dangerBanner: this.require("dangerBanner"),
      dangerText: this.require("dangerText"),
      hint: this.require("hint"),
      toast: this.require("toast"),
      action: this.require("actionButton"),
      actionIcon: this.require("actionIcon"),
      actionText: this.require("actionText"),
      radar,
      radarFill: this.require("radarFill"),
      radarState: this.require("radarState")
    };
    this.installAccessibilityContracts();
    this.unsubscribe = [
      this.events.on("hud:model:changed", payload => this.render(payload)),
      this.events.on("finding:collected", payload => this.showToast(`NÁLEZ ZAPSÁN · +${Math.round(payload.score)} BODŮ`, "good")),
      this.events.on("objective:complete", () => this.showToast("ÚKOL SPLNĚN", "good")),
      this.events.on("dig:clean", () => this.showToast("ČISTÉ KOPÁNÍ +10 %", "rare"))
    ];
    this.toastTimer = null;
  }

  require(id) {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing HUD element: #${id}`);
    return element;
  }

  ensureRadarPanel() {
    const existing = this.document.getElementById("radarPanel");
    if (existing) return existing;
    const hud = this.require("hud");
    const panel = this.document.createElement("div");
    panel.id = "radarPanel";
    panel.className = "radar-panel hidden";
    panel.setAttribute("aria-label", "Radar vltavínů");

    const label = this.document.createElement("span");
    label.className = "radar-label";
    label.textContent = "RADAR";

    const track = this.document.createElement("i");
    track.className = "radar-track";
    const fill = this.document.createElement("em");
    fill.id = "radarFill";
    track.append(fill);

    const state = this.document.createElement("strong");
    state.id = "radarState";
    state.className = "radar-state";
    state.textContent = "VYPNUTO";

    panel.append(label, track, state);
    hud.append(panel);
    return panel;
  }

  installAccessibilityContracts() {
    const elements = this.elements;
    elements.dangerMeter.setAttribute("role", "progressbar");
    elements.dangerBanner.setAttribute("role", "status");
    elements.dangerBanner.setAttribute("aria-live", "polite");
    elements.objectiveProgress.setAttribute("role", "progressbar");
    elements.toast.setAttribute("role", "status");
    elements.toast.setAttribute("aria-live", "polite");
    elements.toast.setAttribute("aria-hidden", "true");
    elements.radar.setAttribute("role", "meter");
    elements.radar.setAttribute("aria-valuemin", "0");
    elements.radar.setAttribute("aria-valuemax", "100");
    elements.radar.setAttribute("aria-valuenow", "0");
    elements.radar.setAttribute("aria-hidden", "true");
    elements.action.removeAttribute?.("aria-pressed");
  }

  showToast(text, tone = "good") {
    const toast = this.elements.toast;
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    toast.textContent = String(text ?? "");
    toast.classList.remove("good", "bad", "rare");
    toast.classList.add("show", tone);
    toast.setAttribute("aria-hidden", "false");
    this.toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toast.setAttribute("aria-hidden", "true");
      this.toastTimer = null;
    }, 2200);
  }

  render({ revision, model }) {
    if (!Number.isFinite(revision) || !model || typeof model !== "object") return;
    const nextFingerprint = fingerprint(revision, model);
    if (nextFingerprint === this.lastFingerprint) return;
    this.lastFingerprint = nextFingerprint;
    this.revision = revision;

    const elements = this.elements;
    elements.missionNumber.textContent = String(model.missionNumber ?? 1);
    elements.placeLabel.textContent = String(model.placeLabel ?? "").toUpperCase();
    elements.objectiveLabel.textContent = String(model.objective ?? "");
    const objectiveProgress = clamp01(model.objectiveProgress);
    const objectivePercent = Math.round(objectiveProgress * 100);
    elements.objectiveProgress.textContent = `POSTUP ${objectivePercent} %`;
    elements.objectiveProgress.setAttribute("aria-valuemin", "0");
    elements.objectiveProgress.setAttribute("aria-valuemax", "100");
    elements.objectiveProgress.setAttribute("aria-valuenow", String(objectivePercent));
    elements.objectiveProgress.setAttribute("aria-valuetext", `${objectivePercent} %`);
    elements.bagValue.textContent = String(Math.max(0, Number(model.findings) || 0));

    const danger = clamp01(model.danger);
    const warning = danger >= 0.35;
    const detected = danger >= 0.75;
    const critical = danger >= 0.9;
    const dangerState = critical ? "KRITICKÉ" : detected ? "POPLACH" : warning ? "POZOR" : "KLID";
    elements.dangerFill.style.width = `${Math.round(danger * 1000) / 10}%`;
    elements.dangerMeterText.textContent = dangerState;
    elements.dangerMeter.classList.toggle("warning", warning && !detected);
    elements.dangerMeter.classList.toggle("detected", detected);
    elements.dangerMeter.classList.toggle("critical", critical);
    elements.dangerMeter.setAttribute("aria-valuemin", "0");
    elements.dangerMeter.setAttribute("aria-valuemax", "100");
    elements.dangerMeter.setAttribute("aria-valuenow", String(Math.round(danger * 100)));
    elements.dangerMeter.setAttribute("aria-valuetext", dangerState);

    const dangerMessage = String(model.dangerMessage ?? (detected ? "TRAKTOR JE BLÍZKO" : ""));
    elements.dangerText.textContent = dangerMessage;
    elements.dangerBanner.classList.toggle("hidden", !dangerMessage);
    elements.dangerBanner.setAttribute("aria-hidden", dangerMessage ? "false" : "true");
    elements.app.classList.toggle("danger-state", detected);
    elements.hud.classList.toggle("danger-shake", critical);

    const actionLabel = String(model.actionLabel ?? "AKCE");
    const actionReady = Boolean(model.actionReady);
    const hint = String(model.hint ?? "");
    const interactionPrompt = actionReady
      ? [hint, `AKCE: ${actionLabel}`].filter(Boolean).join(" · ")
      : hint;
    elements.hint.textContent = interactionPrompt;
    elements.hint.classList.toggle("hidden", !interactionPrompt);
    elements.hint.classList.toggle("action-ready", actionReady);

    const radar = radarPresentation(model);
    const radarPercent = Math.round(clamp01(radar.strength) * 100);
    elements.radar.classList.toggle("hidden", !radar.visible);
    elements.radar.dataset.signal = radar.signal;
    elements.radarFill.style.width = `${radarPercent}%`;
    elements.radarState.textContent = radar.label;
    elements.radar.setAttribute("aria-hidden", radar.visible ? "false" : "true");
    elements.radar.setAttribute("aria-valuenow", String(radarPercent));
    elements.radar.setAttribute("aria-valuetext", radar.label);

    const visibleActionLabel = actionReady ? actionLabel : "PŘIBLIŽ SE";
    elements.action.classList.toggle("ready", actionReady);
    elements.action.classList.toggle("unavailable", !actionReady);
    elements.action.setAttribute("aria-label", actionReady ? actionLabel : "Akce není dostupná; přibliž se k cíli.");
    elements.action.setAttribute("aria-disabled", actionReady ? "false" : "true");
    elements.action.setAttribute("data-action-ready", actionReady ? "true" : "false");
    elements.actionIcon.textContent = actionReady ? String(model.actionIcon ?? "◉") : "↗";
    elements.actionText.textContent = visibleActionLabel;
  }

  dispose() {
    for (const unsubscribe of this.unsubscribe ?? []) unsubscribe?.();
    this.unsubscribe = null;
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.lastFingerprint = "";
    this.elements.app.classList.remove("danger-state");
    this.elements.hud.classList.remove("danger-shake");
    this.elements.hint.classList.remove("action-ready");
    this.elements.action.classList.remove("ready");
    this.elements.action.classList.remove("unavailable");
    this.elements.radar.classList.add("hidden");
    this.elements.radar.setAttribute("aria-hidden", "true");
    this.elements.toast.classList.remove("show", "good", "bad", "rare");
    this.elements.toast.setAttribute("aria-hidden", "true");
  }
}

export { radarPresentation };
