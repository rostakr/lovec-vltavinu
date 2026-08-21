// Environment theming system - applies visual design to game world

export const ENVIRONMENT_THEMES = {
  chlum: {
    name: "Chlum",
    description: "Pole po dešti",
    mood: "natural-agriculture",
    palette: {
      sky: 0x87CEEB,
      skyAlt: 0xB0E0E6,
      grass: 0x2D5016,
      soil: 0x5C4033,
      soilDark: 0x3E2B20,
      water: 0x4A90E2,
      waterPuddle: 0x6BA3E5,
      accent: 0xCC0000, // Tractor
      primary: 0x5C4033,
      secondary: 0x2D5016
    },
    lighting: {
      ambientIntensity: 1.0,
      directionalIntensity: 0.8,
      directionalPosition: { x: -20, y: 20, z: 30 },
      fogColor: 0x87CEEB,
      fogNear: 100,
      fogFar: 3000
    },
    hazardColor: 0xCC0000,
    audio: {
      ambient: "field-ambience",
      theme: "field-theme"
    }
  },

  nesmen: {
    name: "Nešmen",
    description: "Lesní profily",
    mood: "scientific-forest",
    palette: {
      treeDark: 0x1B4D1B,
      treeMid: 0x2D5016,
      soilForest: 0x3E2B20,
      moss: 0x6B8E23,
      scientific: 0x8B7355,
      stone: 0x696969,
      sky: 0x556B2F,
      primary: 0x3E2B20,
      secondary: 0x6B8E23
    },
    lighting: {
      ambientIntensity: 0.8, // Dimmer in forest
      directionalIntensity: 0.6,
      directionalPosition: { x: -15, y: 15, z: 20 },
      fogColor: 0x3E5C20,
      fogNear: 50,
      fogFar: 1500 // Thicker fog in forest
    },
    hazardColor: 0xFFD700, // Yellow for forester
    audio: {
      ambient: "forest-ambience",
      theme: "forest-theme"
    }
  },

  besednice: {
    name: "Bešednice",
    description: "Lom",
    mood: "industrial-geology",
    palette: {
      clay: 0xC19A6B,
      clayDark: 0x8B6914,
      terracotta: 0xE2B48F,
      stoneQuarry: 0x696969,
      stoneLight: 0xA9A9A9,
      vegetation: 0x4CAF50,
      rust: 0xA0522D,
      sky: 0xD4A574,
      primary: 0xC19A6B,
      secondary: 0x4CAF50
    },
    lighting: {
      ambientIntensity: 1.2, // Brighter - exposed quarry
      directionalIntensity: 1.0,
      directionalPosition: { x: 25, y: 30, z: 25 },
      fogColor: 0xD4A574,
      fogNear: 200,
      fogFar: 2500
    },
    hazardColor: 0xFFB6C1, // Pink for dryness warning
    audio: {
      ambient: "quarry-ambience",
      theme: "quarry-theme"
    }
  },

  slavia: {
    name: "Slavia",
    description: "Hrad",
    mood: "historic-mystery",
    palette: {
      stoneCastle: 0x808080,
      stoneLight: 0xA9A9A9,
      brick: 0xA0522D,
      mossCastle: 0x6B8E23,
      gold: 0xD4AF37,
      mystery: 0x4B0082,
      sky: 0x696969,
      primary: 0x808080,
      secondary: 0xD4AF37
    },
    lighting: {
      ambientIntensity: 0.9,
      directionalIntensity: 0.7,
      directionalPosition: { x: -30, y: 25, z: 15 },
      fogColor: 0x404040,
      fogNear: 100,
      fogFar: 2000 // Mysterious atmosphere
    },
    hazardColor: 0x4B0082, // Purple for guard
    audio: {
      ambient: "castle-ambience",
      theme: "castle-theme"
    }
  }
};

export class EnvironmentTheme {
  constructor(THREE, options = {}) {
    this.THREE = THREE;
    this.logger = options.logger || console;
    this.currentTheme = null;
    this.scene = null;
  }

  // Apply theme to scene
  apply(scene, locationId) {
    const theme = ENVIRONMENT_THEMES[locationId];
    if (!theme) {
      this.logger.warn(`Unknown location: ${locationId}`);
      return false;
    }

    this.currentTheme = theme;
    this.scene = scene;

    // Update lighting
    this.updateLighting(theme.lighting);

    // Update fog
    this.updateFog(theme.lighting);

    // Store theme reference on scene
    scene.userData.theme = theme;

    this.logger.info(`Applied theme: ${theme.name}`);
    return true;
  }

  updateLighting(lightingConfig) {
    if (!this.scene) return;

    // Find or create ambient light
    let ambientLight = this.scene.getObjectByName("ambient-light");
    if (!ambientLight) {
      ambientLight = new this.THREE.AmbientLight(0xffffff, lightingConfig.ambientIntensity);
      ambientLight.name = "ambient-light";
      this.scene.add(ambientLight);
    } else {
      ambientLight.intensity = lightingConfig.ambientIntensity;
    }

    // Find or create directional light
    let directionalLight = this.scene.getObjectByName("directional-light");
    if (!directionalLight) {
      directionalLight = new this.THREE.DirectionalLight(0xffffff, lightingConfig.directionalIntensity);
      directionalLight.name = "directional-light";
      directionalLight.castShadow = true;
      this.scene.add(directionalLight);
    } else {
      directionalLight.intensity = lightingConfig.directionalIntensity;
    }

    const pos = lightingConfig.directionalPosition;
    directionalLight.position.set(pos.x, pos.y, pos.z);
  }

  updateFog(lightingConfig) {
    if (!this.scene) return;

    const fogColor = lightingConfig.fogColor;
    const fogNear = lightingConfig.fogNear;
    const fogFar = lightingConfig.fogFar;

    if (this.scene.fog) {
      this.scene.fog.color.setHex(fogColor);
      this.scene.fog.near = fogNear;
      this.scene.fog.far = fogFar;
    } else {
      this.scene.fog = new this.THREE.Fog(fogColor, fogNear, fogFar);
    }
  }

  // Get color from current theme
  getColor(colorKey) {
    if (!this.currentTheme) return 0xffffff;
    return this.currentTheme.palette[colorKey] || 0xffffff;
  }

  // Get hazard color for current theme
  getHazardColor() {
    if (!this.currentTheme) return 0xFF6B6B;
    return this.currentTheme.hazardColor;
  }

  // Get theme palette
  getPalette() {
    if (!this.currentTheme) return {};
    return { ...this.currentTheme.palette };
  }

  // Get theme info
  getThemeInfo() {
    if (!this.currentTheme) return null;
    return {
      name: this.currentTheme.name,
      description: this.currentTheme.description,
      mood: this.currentTheme.mood,
      audio: this.currentTheme.audio
    };
  }

  // Create themed material
  createMaterial(type = "standard", options = {}) {
    const materialOptions = {
      ...options,
      color: options.color || this.getColor("primary")
    };

    if (type === "phong") {
      return new this.THREE.MeshPhongMaterial(materialOptions);
    } else if (type === "standard") {
      return new this.THREE.MeshStandardMaterial(materialOptions);
    } else if (type === "basic") {
      return new this.THREE.MeshBasicMaterial(materialOptions);
    }

    return new this.THREE.MeshStandardMaterial(materialOptions);
  }

  // Apply theme to mesh
  applyToMesh(mesh, colorKey = "primary") {
    if (mesh.material) {
      mesh.material.color.setHex(this.getColor(colorKey));
    }
  }

  // Get theme for hazard visualization
  getHazardTheme() {
    return {
      color: this.getHazardColor(),
      intensity: 0.7,
      blinkSpeed: 0.5
    };
  }

  // Animate hazard indicator
  animateHazard(mesh, duration = 600) {
    const hazardTheme = this.getHazardTheme();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) return;

      const progress = (elapsed / duration) % 1;
      const intensity = Math.sin(progress * Math.PI * 2 * hazardTheme.blinkSpeed) * 0.5 + 0.5;

      if (mesh.material) {
        mesh.material.emissive.setHex(hazardTheme.color);
        mesh.material.emissiveIntensity = intensity;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  // Get accessibility variant
  applyAccessibilityMode(mode) {
    if (!this.scene) return;

    switch (mode) {
      case "high-contrast":
        this.applyHighContrast();
        break;
      case "deuteranopia":
        this.applyDeuteranopia();
        break;
      case "protanopia":
        this.applyProtanopia();
        break;
      case "tritanopia":
        this.applyTritanopia();
        break;
    }
  }

  applyHighContrast() {
    if (!this.scene.fog) return;
    // Increase contrast
    this.scene.fog.near *= 0.5;
    for (const light of this.scene.children.filter(c => c.isLight)) {
      light.intensity *= 1.3;
    }
  }

  applyDeuteranopia() {
    // Adjust colors for red-green colorblindness
    // Replace greens with blues/cyans
  }

  applyProtanopia() {
    // Adjust colors for red-green colorblindness (alt)
  }

  applyTritanopia() {
    // Adjust colors for blue-yellow colorblindness
  }

  dispose() {
    this.currentTheme = null;
    this.scene = null;
  }
}

// Global instance
export const environmentTheme = new EnvironmentTheme();
