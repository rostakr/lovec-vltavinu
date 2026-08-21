// Performance monitoring and metrics collection for production

export class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.logInterval = options.logInterval ?? 5000;
    this.metrics = {
      fps: [],
      memory: [],
      loadTimes: {},
      frameTime: [],
      lastTime: performance.now()
    };
    this.isMonitoring = false;
    this.logger = options.logger || console;
  }

  start() {
    if (this.isMonitoring || !this.enabled) return;
    this.isMonitoring = true;

    if (typeof requestAnimationFrame !== 'undefined') {
      this.monitorFPS();
    }

    if (performance.memory && options.trackMemory !== false) {
      this.memoryCheckInterval = setInterval(() => this.trackMemory(), this.logInterval);
    }
  }

  stop() {
    this.isMonitoring = false;
    if (this.memoryCheckInterval) clearInterval(this.memoryCheckInterval);
  }

  monitorFPS() {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const delta = now - this.metrics.lastTime;
    this.metrics.lastTime = now;

    const fps = Math.round(1000 / delta);
    this.metrics.fps.push(fps);

    if (this.metrics.fps.length > 300) this.metrics.fps.shift();

    requestAnimationFrame(() => this.monitorFPS());
  }

  trackMemory() {
    if (performance.memory) {
      this.metrics.memory.push({
        used: performance.memory.usedJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      });

      if (this.metrics.memory.length > 100) this.metrics.memory.shift();
    }
  }

  recordLoadTime(name, startTime) {
    const duration = performance.now() - startTime;
    this.metrics.loadTimes[name] = duration;

    if (duration > 1000) {
      this.logger.warn(`Slow load detected: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  getReport() {
    const fps = this.metrics.fps;
    const avgFps = fps.length > 0 ? Math.round(fps.reduce((a, b) => a + b) / fps.length) : 0;
    const minFps = fps.length > 0 ? Math.min(...fps) : 0;
    const maxFps = fps.length > 0 ? Math.max(...fps) : 0;

    const memory = this.metrics.memory;
    const latestMemory = memory.length > 0 ? memory[memory.length - 1] : null;
    const memoryUsageMB = latestMemory ? (latestMemory.used / 1024 / 1024).toFixed(2) : 'N/A';
    const memoryLimitMB = latestMemory ? (latestMemory.limit / 1024 / 1024).toFixed(2) : 'N/A';

    return {
      fps: { avg: avgFps, min: minFps, max: maxFps },
      memory: { used: memoryUsageMB, limit: memoryLimitMB },
      loadTimes: this.metrics.loadTimes,
      timestamp: Date.now()
    };
  }

  logReport() {
    const report = this.getReport();
    this.logger.info('Performance Report:', {
      fps: `${report.fps.avg} avg (${report.fps.min}-${report.fps.max})`,
      memory: `${report.memory.used}MB / ${report.memory.limit}MB`,
      slowLoads: Object.entries(report.loadTimes)
        .filter(([, time]) => time > 500)
        .map(([name, time]) => `${name}: ${time.toFixed(2)}ms`)
    });
  }

  checkForMemoryLeak(threshold = 0.8) {
    const memory = this.metrics.memory;
    if (memory.length < 10) return false;

    const recent = memory.slice(-10);
    const trend = recent.map(m => m.used / m.limit);
    const avgTrend = trend.reduce((a, b) => a + b) / trend.length;

    if (avgTrend > threshold) {
      this.logger.warn(`Potential memory leak detected: ${(avgTrend * 100).toFixed(1)}% usage`);
      return true;
    }

    return false;
  }

  checkPerformanceHealth() {
    const report = this.getReport();
    const issues = [];

    if (report.fps.avg < 30) issues.push('Low FPS detected');
    if (report.fps.min < 15) issues.push('Frame drops detected');
    if (this.checkForMemoryLeak()) issues.push('Memory leak suspected');

    return {
      healthy: issues.length === 0,
      issues,
      report
    };
  }

  dispose() {
    this.stop();
    this.metrics = null;
  }
}

// Global instance for easy access
export const perfMonitor = new PerformanceMonitor({
  enabled: !globalThis.location?.search.includes('noperf')
});
