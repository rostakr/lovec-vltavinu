// Bootstrap persistence layer initialization
// Wires up storage adapters to game systems

import { StorageAdapter } from '../persistence/StorageAdapter.js';
import { LevelProgression } from './gameplay/LevelProgression.js';
import { SettingsPanel, DEFAULT_SETTINGS } from './ui/SettingsPanel.js';
import { TutorialSystem } from './ui/TutorialSystem.js';

// Initialize storage adapters for each game system
const levelProgressAdapter = new StorageAdapter({
  keyPrefix: 'moldavite-level-progress-'
});

const settingsAdapter = new StorageAdapter({
  keyPrefix: 'moldavite-settings-'
});

const tutorialAdapter = new StorageAdapter({
  keyPrefix: 'moldavite-tutorial-progress-'
});

// Re-export initialized game systems with injected adapters
export const levelProgression = new LevelProgression({ storageAdapter: levelProgressAdapter });
export const settingsPanel = new SettingsPanel({ storageAdapter: settingsAdapter });
export const tutorialSystem = new TutorialSystem({ storageAdapter: tutorialAdapter });
