import { EndpointMonitor, HealthStatus } from 'endpoint-health-checker';
import { initialEndpoints } from '../config/endpoints.js';

class MonitoringService {
  constructor() {
    const defaultInterval = parseInt(process.env.DEFAULT_INTERVAL_MS, 10) || 30000;
    const defaultTimeout = parseInt(process.env.DEFAULT_TIMEOUT_MS, 10) || 5000;

    // Instantiate EndpointMonitor from published npm package
    this.monitor = new EndpointMonitor({
      defaultIntervalMs: defaultInterval,
      defaultTimeoutMs: defaultTimeout,
      maxHistorySize: 50
    });

    // Concurrency control to prevent overlapping checks
    this.inFlightChecks = new Map(); // endpointId -> Promise
    this.isGlobalCheckInFlight = false;
    this.globalCheckPromise = null;

    this._setupEventListeners();
    this._loadInitialEndpoints();
  }

  /**
   * Registers event handlers to demonstrate real-time notifications from EndpointMonitor.
   * @private
   */
  _setupEventListeners() {
    this.monitor.on('up', (report) => {
      console.log(`[STATUS: UP] ${report.name} (${report.url}) - Latency: ${report.latencyMs}ms`);
    });

    this.monitor.on('degraded', (report) => {
      console.warn(`[STATUS: DEGRADED] ${report.name} (${report.url}) - Latency: ${report.latencyMs}ms exceeds threshold`);
    });

    this.monitor.on('down', (report) => {
      console.error(`[STATUS: DOWN] ${report.name} (${report.url}) - Error: ${report.error}`);
    });

    this.monitor.on('timeout', (report) => {
      console.warn(`[STATUS: TIMEOUT] ${report.name} (${report.url}) - Request timed out`);
    });

    this.monitor.on('recovered', (report) => {
      console.log(`[STATUS: RECOVERED] ${report.name} (${report.url}) returned to healthy state`);
    });

    this.monitor.on('error', (err, id) => {
      console.error(`[MONITOR ERROR] Scheduler error for endpoint "${id}":`, err?.message || err);
    });
  }

  /**
   * Registers initial sample endpoints into the monitor.
   * @private
   */
  _loadInitialEndpoints() {
    for (const endpoint of initialEndpoints) {
      try {
        this.monitor.addEndpoint(endpoint);
      } catch (err) {
        console.error(`Failed to register seed endpoint "${endpoint.name}":`, err.message);
      }
    }
  }

  /**
   * Starts automatic background monitoring.
   * @param {boolean} [runImmediately=true]
   */
  start(runImmediately = true) {
    if (!this.monitor.isRunning()) {
      this.monitor.start({ runImmediately });
    }
  }

  /**
   * Stops background monitoring timers.
   */
  stop() {
    if (this.monitor.isRunning()) {
      this.monitor.stop();
    }
  }

  /**
   * Returns whether background monitoring is running.
   * @returns {boolean}
   */
  isRunning() {
    return this.monitor.isRunning();
  }

  /**
   * Returns structured dashboard data including summary statistics.
   * Directly uses monitor.exportJSON().
   * @returns {Object}
   */
  getDashboardData() {
    const exportData = this.monitor.exportJSON({ stringify: false });
    return {
      ...exportData,
      isMonitoringActive: this.monitor.isRunning()
    };
  }

  /**
   * Returns status and metrics for a specific endpoint.
   * @param {string} id
   * @returns {Object|null}
   */
  getEndpointStatus(id) {
    return this.monitor.getStatus(id);
  }

  /**
   * Executes a concurrency-safe immediate health check for a single endpoint.
   * Protects against duplicate parallel probes to the same endpoint.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async checkEndpointNow(id) {
    const existing = this.inFlightChecks.get(id);
    if (existing) {
      return existing;
    }

    const checkPromise = (async () => {
      try {
        return await this.monitor.checkNow(id);
      } finally {
        this.inFlightChecks.delete(id);
      }
    })();

    this.inFlightChecks.set(id, checkPromise);
    return checkPromise;
  }

  /**
   * Executes a concurrency-safe immediate health check for all endpoints.
   * Protects against multiple concurrent global checks.
   * @returns {Promise<Object[]>}
   */
  async checkAllNow() {
    if (this.isGlobalCheckInFlight && this.globalCheckPromise) {
      return this.globalCheckPromise;
    }

    this.isGlobalCheckInFlight = true;
    this.globalCheckPromise = (async () => {
      try {
        return await this.monitor.checkNow();
      } finally {
        this.isGlobalCheckInFlight = false;
        this.globalCheckPromise = null;
      }
    })();

    return this.globalCheckPromise;
  }

  /**
   * Adds a new endpoint to be monitored.
   * @param {Object} config
   * @returns {Object} Registered endpoint status
   */
  addEndpoint(config) {
    this.monitor.addEndpoint(config);
    return this.monitor.getStatus(config.id || config.url);
  }

  /**
   * Removes an endpoint and cancels its monitoring timer.
   * @param {string} id
   * @returns {boolean}
   */
  removeEndpoint(id) {
    return this.monitor.removeEndpoint(id);
  }

  /**
   * Returns total count of registered endpoints.
   * @returns {number}
   */
  getEndpointCount() {
    return this.monitor.getEndpointCount();
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
export { HealthStatus };
