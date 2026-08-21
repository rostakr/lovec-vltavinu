// Storage abstraction layer - handles all persistence operations
// This module is the single source of truth for localStorage access

export class StorageAdapter {
  constructor(options = {}) {
    this.backend = options.backend || localStorage;
    this.keyPrefix = options.keyPrefix || "moldavite-";
  }

  /**
   * Load data from storage
   * @param {string} key Storage key (will be prefixed)
   * @returns {any} Parsed data or null if not found
   */
  load(key = "") {
    try {
      const fullKey = key ? this.keyPrefix + key : key;
      const data = this.backend.getItem(fullKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to load from storage: ${error.message}`);
      return null;
    }
  }

  /**
   * Save data to storage
   * @param {any} data Data to save (will be stringified)
   * @param {string} key Storage key (will be prefixed)
   */
  save(data, key = "") {
    try {
      const fullKey = key ? this.keyPrefix + key : key;
      this.backend.setItem(fullKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save to storage: ${error.message}`);
    }
  }

  /**
   * Remove data from storage
   * @param {string} key Storage key (will be prefixed)
   */
  remove(key = "") {
    try {
      const fullKey = key ? this.keyPrefix + key : key;
      this.backend.removeItem(fullKey);
    } catch (error) {
      console.error(`Failed to remove from storage: ${error.message}`);
    }
  }

  /**
   * Clear all prefixed data from storage
   */
  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < this.backend.length; i++) {
        const key = this.backend.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.backend.removeItem(key));
    } catch (error) {
      console.error(`Failed to clear storage: ${error.message}`);
    }
  }

  /**
   * Check if a key exists in storage
   * @param {string} key Storage key (will be prefixed)
   * @returns {boolean}
   */
  has(key = "") {
    try {
      const fullKey = key ? this.keyPrefix + key : key;
      return this.backend.getItem(fullKey) !== null;
    } catch (error) {
      return false;
    }
  }
}

// Global singleton instance
export const storageAdapter = new StorageAdapter();
