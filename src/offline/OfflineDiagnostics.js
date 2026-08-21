// Offline functionality diagnostics and testing

export class OfflineDiagnostics {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.testResults = {};
  }

  // Check if service worker is registered
  async checkServiceWorker() {
    try {
      if (!navigator.serviceWorker) {
        return { status: 'NOT_SUPPORTED', message: 'Service Workers not supported' };
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        return { status: 'NOT_REGISTERED', message: 'No service workers registered' };
      }

      const sw = registrations[0];
      return {
        status: 'REGISTERED',
        url: sw.scope,
        active: !!sw.active,
        message: `Service Worker: ${sw.scope}`
      };
    } catch (error) {
      return { status: 'ERROR', message: error.message };
    }
  }

  // Check cache storage
  async checkCacheStorage() {
    try {
      if (!window.caches) {
        return { status: 'NOT_SUPPORTED', message: 'Cache API not supported' };
      }

      const cacheNames = await caches.keys();
      const sizes = {};
      let totalSize = 0;

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        sizes[name] = keys.length;
        totalSize += keys.length;
      }

      return {
        status: 'OK',
        caches: cacheNames,
        sizes,
        totalEntries: totalSize,
        message: `Caches found: ${cacheNames.join(', ')}`
      };
    } catch (error) {
      return { status: 'ERROR', message: error.message };
    }
  }

  // Test offline resource availability
  async testOfflineResources(resources = []) {
    const results = {};

    for (const resource of resources) {
      try {
        const response = await fetch(resource, { method: 'HEAD' });
        results[resource] = { status: response.status, available: response.ok };
      } catch (error) {
        results[resource] = { status: 'OFFLINE', available: false };
      }
    }

    return results;
  }

  // Simulate offline mode
  async simulateOffline() {
    const originalFetch = window.fetch;
    let isOffline = false;

    window.fetch = function(...args) {
      if (isOffline) {
        return Promise.reject(new TypeError('Network request failed'));
      }
      return originalFetch.apply(this, args);
    };

    return {
      enable: () => { isOffline = true; },
      disable: () => { isOffline = false; },
      restore: () => { window.fetch = originalFetch; }
    };
  }

  // Run full diagnostics
  async runFullDiagnostics(options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      serviceWorker: await this.checkServiceWorker(),
      cacheStorage: await this.checkCacheStorage(),
      resources: await this.testOfflineResources(options.resources || [])
    };

    this.testResults = results;
    return results;
  }

  // Generate diagnostics report
  generateReport() {
    const results = this.testResults;
    let report = `=== Offline Diagnostics Report ===\n`;
    report += `Timestamp: ${results.timestamp}\n`;
    report += `Online Status: ${results.online ? 'ONLINE' : 'OFFLINE'}\n\n`;

    report += `Service Worker:\n`;
    report += `  Status: ${results.serviceWorker.status}\n`;
    report += `  Message: ${results.serviceWorker.message}\n\n`;

    report += `Cache Storage:\n`;
    report += `  Status: ${results.cacheStorage.status}\n`;
    report += `  Message: ${results.cacheStorage.message}\n`;
    if (results.cacheStorage.caches) {
      report += `  Caches: ${results.cacheStorage.caches.join(', ')}\n`;
    }
    report += '\n';

    if (Object.keys(results.resources).length > 0) {
      report += `Resources:\n`;
      for (const [resource, result] of Object.entries(results.resources)) {
        report += `  ${resource}: ${result.available ? 'OK' : 'FAIL'}\n`;
      }
    }

    return report;
  }

  // Log diagnostics
  logDiagnostics() {
    const report = this.generateReport();
    this.logger.info(report);
    return report;
  }

  // Check specific PWA requirements
  async checkPWARequirements() {
    const checks = {
      https: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      manifest: document.querySelector('link[rel="manifest"]') !== null,
      icon: document.querySelector('link[rel="apple-touch-icon"]') !== null,
      viewport: document.querySelector('meta[name="viewport"]') !== null,
      offline: (await this.checkServiceWorker()).status === 'REGISTERED'
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.values(checks).length;

    return {
      checks,
      passed,
      total,
      score: Math.round((passed / total) * 100)
    };
  }

  dispose() {
    this.testResults = null;
  }
}

// Global instance
export const offlineDiagnostics = new OfflineDiagnostics();
