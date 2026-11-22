/**
 * Default sample endpoints for the Endpoint Health Monitor Demo.
 * Includes representative scenarios to showcase UP, DEGRADED, DOWN, and TIMEOUT states.
 */

export const initialEndpoints = [
  {
    id: 'jsonplaceholder-api',
    name: 'JSONPlaceholder API',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET',
    expectedStatus: 200,
    intervalMs: 30000
  },
  {
    id: 'dummyjson-api',
    name: 'DummyJSON Test API',
    url: 'https://dummyjson.com/test',
    method: 'GET',
    expectedStatus: 200,
    intervalMs: 30000
  },
  {
    id: 'github-zen-degraded',
    name: 'GitHub Zen API (Degraded Latency Demo)',
    url: 'https://api.github.com/zen',
    method: 'GET',
    headers: { 'User-Agent': 'EndpointHealthCheckerDemo/1.0' },
    expectedStatus: 200,
    maxLatencyMs: 50, // Triggers DEGRADED status when latency exceeds 50ms
    intervalMs: 30000
  },
  {
    id: 'failing-endpoint-404',
    name: 'Failing API (404 Down Demo)',
    url: 'https://jsonplaceholder.typicode.com/invalid-route-404-test',
    method: 'GET',
    expectedStatus: 200, // Expects 200, received 404 -> Triggers DOWN status
    intervalMs: 30000
  },
  {
    id: 'timeout-endpoint-blackhole',
    name: 'Unresponsive API (Timeout Demo)',
    url: 'https://10.255.255.1/',
    method: 'GET',
    timeoutMs: 1200, // Non-routable IP with short deadline -> Triggers TIMEOUT status
    intervalMs: 30000
  }
];
