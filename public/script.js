/**
 * Endpoint Health Monitor Dashboard - Client Application
 * Communicates with backend Express REST API powered by endpoint-health-checker
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    endpoints: [],
    summary: { totalEndpoints: 0, up: 0, degraded: 0, down: 0, timeout: 0, unknown: 0 },
    isMonitoringActive: true,
    isCheckingAll: false,
    checkingEndpoints: new Set(),
    pollInterval: null
  };

  // DOM Elements
  const statTotal = document.getElementById('stat-total');
  const statUp = document.getElementById('stat-up');
  const statDegraded = document.getElementById('stat-degraded');
  const statDown = document.getElementById('stat-down');
  const statTimeout = document.getElementById('stat-timeout');
  const lastUpdatedEl = document.getElementById('lastUpdated');

  const monitoringIndicator = document.getElementById('monitoringIndicator');
  const monitoringIndicatorText = document.getElementById('monitoringIndicatorText');
  const btnToggleMonitoring = document.getElementById('btnToggleMonitoring');
  const toggleMonitoringIcon = document.getElementById('toggleMonitoringIcon');
  const toggleMonitoringText = document.getElementById('toggleMonitoringText');

  const btnRefresh = document.getElementById('btnRefresh');
  const btnCheckAll = document.getElementById('btnCheckAll');
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnEmptyAdd = document.getElementById('btnEmptyAdd');

  const endpointsGrid = document.getElementById('endpointsGrid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');

  const addEndpointModal = document.getElementById('addEndpointModal');
  const addEndpointForm = document.getElementById('addEndpointForm');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const toastContainer = document.getElementById('toastContainer');

  /**
   * Format ISO date string into readable relative or clock time
   */
  function formatTimestamp(isoString) {
    if (!isoString) return 'Never checked';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';

    const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secondsAgo < 5) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /**
   * Display a floating toast notification
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Sanitize HTML strings
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Fetch live dashboard data from /api/status
   */
  async function fetchDashboardData(showLoading = false) {
    if (showLoading) {
      loadingState.classList.remove('hidden');
    }

    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (json.success && json.data) {
        state.endpoints = json.data.endpoints || [];
        state.summary = json.data.summary || state.summary;
        state.isMonitoringActive = Boolean(json.data.isMonitoringActive);

        renderSummary(state.summary);
        renderMonitoringState(state.isMonitoringActive);
        renderEndpoints(state.endpoints);

        if (json.data.generatedAt) {
          lastUpdatedEl.textContent = `Last updated: ${new Date(json.data.generatedAt).toLocaleTimeString()}`;
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showToast(`Error fetching status: ${err.message}`, 'error');
    } finally {
      if (showLoading) {
        loadingState.classList.add('hidden');
      }
    }
  }

  /**
   * Update top statistic cards
   */
  function renderSummary(summary) {
    statTotal.textContent = summary.totalEndpoints ?? 0;
    statUp.textContent = summary.up ?? 0;
    statDegraded.textContent = summary.degraded ?? 0;
    statDown.textContent = summary.down ?? 0;
    statTimeout.textContent = summary.timeout ?? 0;
  }

  /**
   * Update periodic monitoring state indicators and buttons
   */
  function renderMonitoringState(isActive) {
    if (isActive) {
      monitoringIndicator.classList.remove('paused');
      monitoringIndicatorText.textContent = 'Monitoring Active';
      toggleMonitoringIcon.textContent = '⏸';
      toggleMonitoringText.textContent = 'Pause Polling';
    } else {
      monitoringIndicator.classList.add('paused');
      monitoringIndicatorText.textContent = 'Monitoring Paused';
      toggleMonitoringIcon.textContent = '▶';
      toggleMonitoringText.textContent = 'Resume Polling';
    }
  }

  /**
   * Render endpoint cards grid
   */
  function renderEndpoints(endpoints) {
    if (!endpoints || endpoints.length === 0) {
      endpointsGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    endpointsGrid.innerHTML = endpoints.map((ep) => {
      const statusClass = `status-${(ep.status || 'unknown').toLowerCase()}`;
      const isChecking = state.checkingEndpoints.has(ep.id) || state.isCheckingAll;

      const statusCodeDisplay = ep.statusCode ? `${ep.statusCode}` : '—';
      const latencyDisplay = ep.latencyMs !== undefined && ep.latencyMs !== null && ep.latencyMs > 0
        ? `${ep.latencyMs}ms`
        : '—';

      const uptimePercent = ep.metrics?.uptimePercentage !== undefined
        ? `${ep.metrics.uptimePercentage}%`
        : '—';

      let noticeHtml = '';
      if (ep.status === 'DEGRADED') {
        noticeHtml = `<div class="degraded-notice">⚠️ Latency alert: ${escapeHtml(ep.error || 'High latency threshold exceeded')}</div>`;
      } else if (ep.status === 'DOWN' || ep.status === 'TIMEOUT') {
        noticeHtml = `<div class="error-notice">❌ ${escapeHtml(ep.error || 'Endpoint failed health check')}</div>`;
      }

      return `
        <div class="endpoint-card" data-id="${escapeHtml(ep.id)}">
          <div class="endpoint-card-header">
            <div class="endpoint-title-group">
              <h3 class="endpoint-name" title="${escapeHtml(ep.name)}">${escapeHtml(ep.name)}</h3>
              <span class="endpoint-url" title="${escapeHtml(ep.url)}">
                <span class="method-tag">${escapeHtml(ep.method || 'GET')}</span>${escapeHtml(ep.url)}
              </span>
            </div>
            <div class="status-badge ${statusClass}">
              <span>●</span>
              <span>${escapeHtml(ep.status || 'UNKNOWN')}</span>
            </div>
          </div>

          <div class="metrics-row">
            <div class="metric-item">
              <span class="metric-item-label">HTTP Code</span>
              <span class="metric-item-value">${escapeHtml(statusCodeDisplay)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Latency</span>
              <span class="metric-item-value">${escapeHtml(latencyDisplay)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Uptime</span>
              <span class="metric-item-value">${escapeHtml(uptimePercent)}</span>
            </div>
          </div>

          ${noticeHtml}

          <div class="endpoint-card-footer">
            <span class="endpoint-timestamp">${formatTimestamp(ep.evaluatedAt || ep.probeTimestamp)}</span>
            <div class="endpoint-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-check-single" data-id="${escapeHtml(ep.id)}" ${isChecking ? 'disabled' : ''}>
                <span>${isChecking ? '⏳' : '⚡'}</span>
                <span>Check</span>
              </button>
              <button type="button" class="btn btn-danger-outline btn-sm btn-remove-endpoint" data-id="${escapeHtml(ep.id)}" data-name="${escapeHtml(ep.name)}">
                <span>🗑</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Trigger health check for all endpoints
   */
  async function checkAllNow() {
    if (state.isCheckingAll) return;

    state.isCheckingAll = true;
    btnCheckAll.disabled = true;
    btnCheckAll.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;"></span> <span>Checking...</span>';

    try {
      showToast('Initiating probe on all endpoints...', 'info');
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Check failed');
      }

      showToast('All health checks completed!', 'success');
      await fetchDashboardData();
    } catch (err) {
      console.error('Manual check error:', err);
      showToast(`Health check error: ${err.message}`, 'error');
    } finally {
      state.isCheckingAll = false;
      btnCheckAll.disabled = false;
      btnCheckAll.innerHTML = '<span class="btn-icon">⚡</span> <span>Check All Now</span>';
    }
  }

  /**
   * Trigger health check for a single endpoint
   */
  async function checkSingleNow(id) {
    if (state.checkingEndpoints.has(id)) return;

    state.checkingEndpoints.add(id);
    renderEndpoints(state.endpoints); // Update button state to loading

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Check failed');
      }

      showToast(`Checked ${json.data?.name || id}: ${json.data?.status}`, 'info');
      await fetchDashboardData();
    } catch (err) {
      console.error('Single check error:', err);
      showToast(`Check failed: ${err.message}`, 'error');
    } finally {
      state.checkingEndpoints.delete(id);
      renderEndpoints(state.endpoints);
    }
  }

  /**
   * Toggle background monitoring on/off
   */
  async function toggleMonitoring() {
    const endpoint = state.isMonitoringActive ? '/api/monitoring/stop' : '/api/monitoring/start';
    btnToggleMonitoring.disabled = true;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        state.isMonitoringActive = Boolean(json.isMonitoringActive);
        renderMonitoringState(state.isMonitoringActive);
        showToast(json.message, 'info');
      }
    } catch (err) {
      showToast(`Failed to toggle monitoring: ${err.message}`, 'error');
    } finally {
      btnToggleMonitoring.disabled = false;
    }
  }

  /**
   * Modal handling
   */
  function openModal() {
    addEndpointModal.classList.remove('hidden');
    document.getElementById('inputUrl').focus();
  }

  function closeModal() {
    addEndpointModal.classList.add('hidden');
    addEndpointForm.reset();
  }

  /**
   * Handle Add Endpoint Form Submission
   */
  async function handleAddEndpoint(e) {
    e.preventDefault();

    const formData = new FormData(addEndpointForm);
    const payload = {
      url: formData.get('url')?.trim(),
      name: formData.get('name')?.trim() || undefined,
      method: formData.get('method') || 'GET',
      expectedStatus: formData.get('expectedStatus') ? Number(formData.get('expectedStatus')) : undefined,
      maxLatencyMs: formData.get('maxLatencyMs') ? Number(formData.get('maxLatencyMs')) : undefined,
      timeoutMs: formData.get('timeoutMs') ? Number(formData.get('timeoutMs')) : undefined,
      intervalMs: formData.get('intervalMs') ? Number(formData.get('intervalMs')) : undefined
    };

    const submitBtn = document.getElementById('btnSubmitAdd');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const response = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to add endpoint');
      }

      showToast(`Added endpoint: ${json.data?.name || payload.url}`, 'success');
      closeModal();

      // Probing newly added endpoint immediately
      if (json.data?.id) {
        checkSingleNow(json.data.id);
      } else {
        await fetchDashboardData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add & Start Monitoring';
    }
  }

  /**
   * Handle Delete Endpoint
   */
  async function handleDeleteEndpoint(id, name) {
    if (!confirm(`Are you sure you want to stop monitoring "${name || id}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/endpoints/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to remove endpoint');
      }

      showToast(json.message || `Removed endpoint "${name || id}"`, 'info');
      await fetchDashboardData();
    } catch (err) {
      showToast(`Failed to remove: ${err.message}`, 'error');
    }
  }

  // Event Listeners
  btnRefresh.addEventListener('click', () => {
    fetchDashboardData(true);
    showToast('Dashboard refreshed', 'info');
  });

  btnCheckAll.addEventListener('click', checkAllNow);
  btnToggleMonitoring.addEventListener('click', toggleMonitoring);
  btnOpenAddModal.addEventListener('click', openModal);
  btnEmptyAdd.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  addEndpointModal.addEventListener('click', (e) => {
    if (e.target === addEndpointModal) closeModal();
  });

  addEndpointForm.addEventListener('submit', handleAddEndpoint);

  // Delegated events for cards (check and delete)
  endpointsGrid.addEventListener('click', (e) => {
    const checkBtn = e.target.closest('.btn-check-single');
    if (checkBtn) {
      const id = checkBtn.dataset.id;
      if (id) checkSingleNow(id);
      return;
    }

    const removeBtn = e.target.closest('.btn-remove-endpoint');
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      const name = removeBtn.dataset.name;
      if (id) handleDeleteEndpoint(id, name);
    }
  });

  // Initial Load and recurring poll
  fetchDashboardData(true);
  state.pollInterval = setInterval(() => {
    fetchDashboardData(false);
  }, 10000); // 10s client refresh
});
