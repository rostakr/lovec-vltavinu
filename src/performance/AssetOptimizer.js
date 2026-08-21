// Asset loading optimization and caching strategies

export class AssetOptimizer {
  constructor(options = {}) {
    this.cache = new Map();
    this.pendingLoads = new Map();
    this.maxCacheSize = options.maxCacheSize ?? 52428800; // 50MB
    this.currentCacheSize = 0;
    this.logger = options.logger || console;
  }

  // Deduplicate concurrent load requests
  async loadUnique(key, loader) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.pendingLoads.has(key)) {
      return this.pendingLoads.get(key);
    }

    const promise = loader().then(asset => {
      this.cache.set(key, asset);
      this.pendingLoads.delete(key);
      return asset;
    }).catch(error => {
      this.pendingLoads.delete(key);
      throw error;
    });

    this.pendingLoads.set(key, promise);
    return promise;
  }

  // Preload critical assets
  async preloadAssets(assetList) {
    const results = await Promise.allSettled(
      assetList.map(({ key, loader }) => this.loadUnique(key, loader))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(`Failed to preload ${failed.length} assets`);
    }

    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  }

  // LRU cache eviction
  evictLRU() {
    if (this.cache.size === 0) return;

    let oldestKey = this.cache.keys().next().value;
    let oldestTime = Infinity;

    for (const [key] of this.cache) {
      // Simple eviction: remove first (oldest) entry
      oldestKey = key;
      break;
    }

    const asset = this.cache.get(oldestKey);
    this.cache.delete(oldestKey);

    if (asset?.dispose) asset.dispose();
    this.logger.info(`Evicted asset: ${oldestKey}`);
  }

  // Memory pressure management
  checkMemoryPressure() {
    if (this.currentCacheSize > this.maxCacheSize * 0.8) {
      this.logger.warn('High memory pressure - evicting assets');
      while (this.currentCacheSize > this.maxCacheSize * 0.6 && this.cache.size > 0) {
        this.evictLRU();
      }
    }
  }

  // Lazy load non-critical assets
  async lazyLoadAsset(key, loader, priority = 'low') {
    if (priority === 'high') {
      return this.loadUnique(key, loader);
    }

    // Low priority - load on idle
    if (typeof requestIdleCallback !== 'undefined') {
      return new Promise(resolve => {
        requestIdleCallback(() => {
          this.loadUnique(key, loader).then(resolve);
        });
      });
    } else {
      // Fallback: defer with timeout
      return new Promise(resolve => {
        setTimeout(() => {
          this.loadUnique(key, loader).then(resolve);
        }, 0);
      });
    }
  }

  // Measure asset load time
  async measureLoad(key, loader) {
    const start = performance.now();
    const asset = await this.loadUnique(key, loader);
    const duration = performance.now() - start;

    if (duration > 500) {
      this.logger.warn(`Slow asset load: ${key} (${duration.toFixed(2)}ms)`);
    }

    return asset;
  }

  // Unload specific asset
  unload(key) {
    const asset = this.cache.get(key);
    if (asset?.dispose) asset.dispose();
    this.cache.delete(key);
    this.pendingLoads.delete(key);
  }

  // Unload all assets
  unloadAll() {
    for (const asset of this.cache.values()) {
      if (asset?.dispose) asset.dispose();
    }
    this.cache.clear();
    this.pendingLoads.clear();
  }

  // Get cache stats
  getStats() {
    return {
      cachedAssets: this.cache.size,
      pendingLoads: this.pendingLoads.size,
      cacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize,
      hitRate: this.cache.size > 0 ? '~' + (this.cache.size * 100 / (this.cache.size + 5)).toFixed(0) + '%' : 'N/A'
    };
  }

  dispose() {
    this.unloadAll();
  }
}

// Global instance
export const assetOptimizer = new AssetOptimizer();
