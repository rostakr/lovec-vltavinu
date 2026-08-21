// Game settings and preferences panel

export const DEFAULT_SETTINGS = {
  difficulty: "normal",
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  ambienceVolume: 0.4,
  showSubtitles: true,
  showTutorial: true,
  colorBlindMode: "none", // none, deuteranopia, protanopia, tritanopia
  highContrast: false,
  largeText: false,
  screenShake: true,
  particleEffects: true,
  autoSave: true,
  language: "cs" // cs, en
};

export const DIFFICULTY_OPTIONS = [
  { id: "easy", name: "Snadné", description: "Méně kopání, více času" },
  { id: "normal", name: "Normální", description: "Vyvážená obtížnost" },
  { id: "hard", name: "Těžké", description: "Více skrytých lokalit" }
];

export const COLORBLIND_OPTIONS = [
  { id: "none", name: "Normální" },
  { id: "deuteranopia", name: "Deuteranopie (zelená/červená)" },
  { id: "protanopia", name: "Protanopie (červená/zelená)" },
  { id: "tritanopia", name: "Tritanopie (modrá/žlutá)" }
];

export class SettingsPanel {
  constructor(options = {}) {
    this.document = options.document;
    this.logger = options.logger || console;
    this.storageAdapter = options.storageAdapter || null;
    this.settings = this.loadSettings();
    this.listeners = [];
  }

  loadSettings() {
    try {
      if (this.storageAdapter) {
        const saved = this.storageAdapter.load();
        if (saved) {
          return { ...DEFAULT_SETTINGS, ...saved };
        }
      }
      return { ...DEFAULT_SETTINGS };
    } catch (error) {
      this.logger.warn(`Failed to load settings: ${error.message}`);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings() {
    try {
      if (this.storageAdapter) {
        this.storageAdapter.save(this.settings);
      }
      this.notifyListeners("settings-changed", this.settings);
    } catch (error) {
      this.logger.error(`Failed to save settings: ${error.message}`);
    }
  }

  // Create settings panel UI
  createSettingsPanel() {
    const panel = this.document.createElement("div");
    panel.id = "settings-panel";
    panel.className = "settings-panel";
    panel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 6000;
      animation: fadeIn 0.3s ease;
    `;

    const container = this.document.createElement("div");
    container.className = "settings-container";
    container.style.cssText = `
      background: #2a2520;
      border: 3px solid #8B7355;
      padding: 30px;
      border-radius: 12px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: #e0d5c8;
      font-family: inherit;
      animation: slideIn 0.4s ease;
    `;

    // Title
    const title = this.document.createElement("h2");
    title.textContent = "NASTAVENÍ";
    title.style.cssText = `
      margin-top: 0;
      font-size: 24px;
      color: #d4af37;
      border-bottom: 2px solid #8B7355;
      padding-bottom: 15px;
    `;

    container.appendChild(title);

    // Gameplay section
    container.appendChild(this.createSection("HRA", [
      this.createSelect("difficulty", "Obtížnost", DIFFICULTY_OPTIONS),
      this.createCheckbox("autoSave", "Automatické ukládání"),
      this.createCheckbox("showTutorial", "Zobrazit tutorial")
    ]));

    // Audio section
    container.appendChild(this.createSection("ZVUK", [
      this.createSlider("masterVolume", "Celkový hlasitost", 0, 1, 0.1),
      this.createSlider("musicVolume", "Hudba", 0, 1, 0.1),
      this.createSlider("sfxVolume", "Zvukové efekty", 0, 1, 0.1),
      this.createSlider("ambienceVolume", "Ambient", 0, 1, 0.1)
    ]));

    // Accessibility section
    container.appendChild(this.createSection("PŘÍSTUPNOST", [
      this.createSelect("colorBlindMode", "Barevné vidění", COLORBLIND_OPTIONS),
      this.createCheckbox("highContrast", "Vysoký kontrast"),
      this.createCheckbox("largeText", "Větší text"),
      this.createCheckbox("showSubtitles", "Titulky"),
      this.createCheckbox("screenShake", "Třesení obrazovky"),
      this.createCheckbox("particleEffects", "Částicové efekty")
    ]));

    // Language section
    container.appendChild(this.createSection("JAZYK", [
      this.createSelect("language", "Jazyk", [
        { id: "cs", name: "Čeština" },
        { id: "en", name: "English" }
      ])
    ]));

    // Buttons
    const buttons = this.document.createElement("div");
    buttons.style.cssText = `
      display: flex;
      gap: 12px;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #8B7355;
    `;

    const defaultBtn = this.document.createElement("button");
    defaultBtn.textContent = "OBNOVIT VÝCHOZÍ";
    defaultBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      background: #6B5B4A;
      color: #e0d5c8;
      border: 1px solid #8B7355;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;
    `;
    defaultBtn.onclick = () => this.resetToDefaults();

    const closeBtn = this.document.createElement("button");
    closeBtn.textContent = "ZAVŘÍT";
    closeBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      background: #8B7355;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;
    `;
    closeBtn.onclick = () => this.closePanel(panel);

    buttons.appendChild(defaultBtn);
    buttons.appendChild(closeBtn);
    container.appendChild(buttons);

    panel.appendChild(container);
    return panel;
  }

  createSection(title, items) {
    const section = this.document.createElement("div");
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const heading = this.document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = `
      margin: 15px 0 10px 0;
      font-size: 13px;
      color: #d4af37;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #8B7355;
      padding-bottom: 8px;
    `;

    section.appendChild(heading);

    for (const item of items) {
      section.appendChild(item);
    }

    return section;
  }

  createSelect(key, label, options) {
    const div = this.document.createElement("div");
    div.style.cssText = `
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const labelEl = this.document.createElement("label");
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 13px;
      color: #e0d5c8;
    `;

    const select = this.document.createElement("select");
    select.style.cssText = `
      padding: 6px 10px;
      background: #3a3530;
      color: #e0d5c8;
      border: 1px solid #8B7355;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    `;

    for (const opt of options) {
      const option = this.document.createElement("option");
      option.value = opt.id;
      option.textContent = opt.name;
      if (opt.description) {
        option.title = opt.description;
      }
      select.appendChild(option);
    }

    select.value = this.settings[key];
    select.onchange = () => {
      this.settings[key] = select.value;
      this.saveSettings();
    };

    div.appendChild(labelEl);
    div.appendChild(select);
    return div;
  }

  createCheckbox(key, label) {
    const div = this.document.createElement("div");
    div.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const checkbox = this.document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.settings[key];
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #8B7355;
    `;

    const label_el = this.document.createElement("label");
    label_el.textContent = label;
    label_el.style.cssText = `
      font-size: 13px;
      color: #e0d5c8;
      cursor: pointer;
      flex: 1;
    `;

    checkbox.onchange = () => {
      this.settings[key] = checkbox.checked;
      this.saveSettings();
    };

    div.appendChild(checkbox);
    div.appendChild(label_el);
    return div;
  }

  createSlider(key, label, min, max, step) {
    const div = this.document.createElement("div");
    div.style.cssText = `
      margin-bottom: 12px;
    `;

    const labelEl = this.document.createElement("div");
    labelEl.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 12px;
    `;

    const labelText = this.document.createElement("span");
    labelText.textContent = label;
    labelText.style.color = "#e0d5c8";

    const valueText = this.document.createElement("span");
    valueText.textContent = Math.round(this.settings[key] * 100) + "%";
    valueText.style.color = "#d4af37";

    labelEl.appendChild(labelText);
    labelEl.appendChild(valueText);

    const slider = this.document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = this.settings[key];
    slider.style.cssText = `
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #3a3530;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    `;

    slider.oninput = () => {
      this.settings[key] = parseFloat(slider.value);
      valueText.textContent = Math.round(this.settings[key] * 100) + "%";
      this.saveSettings();
    };

    div.appendChild(labelEl);
    div.appendChild(slider);
    return div;
  }

  // Show settings panel
  show() {
    const panel = this.createSettingsPanel();
    this.document.body.appendChild(panel);
    return panel;
  }

  // Close panel
  closePanel(panel) {
    panel.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => {
      panel.remove();
    }, 300);
  }

  // Reset to defaults
  resetToDefaults() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.logger.info("Settings reset to defaults");
  }

  // Get setting
  get(key) {
    return this.settings[key];
  }

  // Set setting
  set(key, value) {
    if (key in this.settings) {
      this.settings[key] = value;
      this.saveSettings();
      return true;
    }
    return false;
  }

  // Get all settings
  getAll() {
    return { ...this.settings };
  }

  // Apply settings to game
  applySettings() {
    // Apply color blind mode
    if (this.settings.colorBlindMode !== "none") {
      this.document.documentElement.setAttribute(
        "data-colorblind",
        this.settings.colorBlindMode
      );
    } else {
      this.document.documentElement.removeAttribute("data-colorblind");
    }

    // Apply high contrast
    this.document.documentElement.classList.toggle(
      "high-contrast",
      this.settings.highContrast
    );

    // Apply large text
    this.document.documentElement.classList.toggle(
      "large-text",
      this.settings.largeText
    );

    // Apply language
    this.document.documentElement.lang = this.settings.language;
  }

  // Event system
  onSettingsChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(eventType, data) {
    for (const listener of this.listeners) {
      try {
        listener({ type: eventType, data });
      } catch (error) {
        this.logger.error(`Settings listener error: ${error.message}`);
      }
    }
  }

  dispose() {
    this.listeners = [];
  }
}

// Global instance - will be initialized with storage adapter in bootstrap
export const settingsPanel = new SettingsPanel();
