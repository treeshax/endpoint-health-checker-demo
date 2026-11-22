import { Router } from 'express';
import { monitoringService } from '../services/monitoringService.js';

const router = Router();

/**
 * Helper to validate HTTP/HTTPS URL
 */
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * GET /api/status
 * Returns aggregated monitoring data, summary metrics, and status of all endpoints.
 */
router.get('/status', (req, res) => {
  try {
    const data = monitoringService.getDashboardData();
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to retrieve monitoring status: ${err.message}`
    });
  }
});

/**
 * GET /api/endpoints/:id
 * Returns current status and detailed metrics for a specific endpoint.
 */
router.get('/endpoints/:id', (req, res) => {
  try {
    const { id } = req.params;
    const endpoint = monitoringService.getEndpointStatus(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: `Endpoint with ID "${id}" not found`
      });
    }

    res.status(200).json({
      success: true,
      data: endpoint
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to retrieve endpoint: ${err.message}`
    });
  }
});

/**
 * POST /api/check
 * Triggers an immediate, concurrency-safe health check.
 * Checks a single endpoint if `id` is provided in body or query; otherwise checks all endpoints.
 */
router.post('/check', async (req, res) => {
  try {
    const id = req.body?.id || req.query?.id;

    if (id) {
      const endpoint = monitoringService.getEndpointStatus(id);
      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: `Endpoint with ID "${id}" not found`
        });
      }

      const result = await monitoringService.checkEndpointNow(id);
      return res.status(200).json({
        success: true,
        message: `Health check completed for endpoint "${id}"`,
        data: result
      });
    }

    const results = await monitoringService.checkAllNow();
    res.status(200).json({
      success: true,
      message: 'Health check completed for all endpoints',
      data: results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Health check failed: ${err.message}`
    });
  }
});

/**
 * POST /api/endpoints
 * Adds a new endpoint to be monitored.
 */
router.post('/endpoints', (req, res) => {
  try {
    const {
      name,
      url,
      method = 'GET',
      expectedStatus,
      maxLatencyMs,
      intervalMs,
      timeoutMs
    } = req.body;

    if (!url || typeof url !== 'string' || !isValidHttpUrl(url.trim())) {
      return res.status(400).json({
        success: false,
        error: 'A valid HTTP or HTTPS URL is required'
      });
    }

    const trimmedUrl = url.trim();
    const endpointId = req.body.id ? String(req.body.id).trim() : `ep-${Date.now()}`;
    const endpointName = name && typeof name === 'string' && name.trim() ? name.trim() : new URL(trimmedUrl).hostname;

    const config = {
      id: endpointId,
      name: endpointName,
      url: trimmedUrl,
      method: String(method).toUpperCase()
    };

    if (expectedStatus !== undefined && expectedStatus !== null && expectedStatus !== '') {
      const parsedStatus = Number(expectedStatus);
      if (Number.isInteger(parsedStatus) && parsedStatus >= 100 && parsedStatus <= 599) {
        config.expectedStatus = parsedStatus;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Expected status must be a valid HTTP status code between 100 and 599'
        });
      }
    }

    if (maxLatencyMs !== undefined && maxLatencyMs !== null && maxLatencyMs !== '') {
      const parsedLatency = Number(maxLatencyMs);
      if (Number.isFinite(parsedLatency) && parsedLatency > 0) {
        config.maxLatencyMs = parsedLatency;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Maximum latency must be a positive number of milliseconds'
        });
      }
    }

    if (intervalMs !== undefined && intervalMs !== null && intervalMs !== '') {
      const parsedInterval = Number(intervalMs);
      if (Number.isFinite(parsedInterval) && parsedInterval >= 1000) {
        config.intervalMs = parsedInterval;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Interval must be at least 1000 milliseconds'
        });
      }
    }

    if (timeoutMs !== undefined && timeoutMs !== null && timeoutMs !== '') {
      const parsedTimeout = Number(timeoutMs);
      if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) {
        config.timeoutMs = parsedTimeout;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Timeout must be a positive number of milliseconds'
        });
      }
    }

    const created = monitoringService.addEndpoint(config);

    res.status(201).json({
      success: true,
      message: `Endpoint "${endpointName}" added successfully`,
      data: created
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * DELETE /api/endpoints/:id
 * Removes a configured endpoint by ID.
 */
router.delete('/endpoints/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = monitoringService.removeEndpoint(id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: `Endpoint with ID "${id}" not found`
      });
    }

    res.status(200).json({
      success: true,
      message: `Endpoint "${id}" removed successfully`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to remove endpoint: ${err.message}`
    });
  }
});

export default router;
