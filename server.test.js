const http = require('http');
const assert = require('assert');

// Import server components for testing - destructured from the robust server module
const { server, gracefulShutdown, connections } = require('./server.js');

// Test tracking variables for result aggregation
let passed = 0;
let failed = 0;
const results = [];

/**
 * Runs a single test case with error handling and result tracking.
 * Wraps the test function in try/catch to prevent unhandled errors
 * from crashing the test runner process.
 * @param {string} name - Test name displayed in output (e.g., "Test 1: Normal GET request returns 200")
 * @param {Function} testFn - Async test function containing assertions
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    passed++;
    console.log(`\u2713 ${name}`);
    results.push({ name, passed: true });
  } catch (error) {
    failed++;
    console.log(`\u2717 ${name}`);
    console.log(`  Error: ${error.message}`);
    results.push({ name, passed: false, error: error.message });
  }
}

/**
 * Makes an HTTP request to the test server and returns the response data.
 * Uses 'Connection: close' header to prevent keep-alive socket retention,
 * ensuring clean socket cleanup between tests.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
 * @param {string} path - Request path (e.g., '/', '/test', '/?key=value')
 * @returns {Promise<Object>} Response object with statusCode, headers, and body properties
 */
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: path || '/',
      method: method || 'GET',
      headers: {
        'Connection': 'close'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

/**
 * Waits for the server to be ready to accept connections.
 * Checks server.listening property first; if not yet listening,
 * waits for the 'listening' event before proceeding.
 * @returns {Promise<void>}
 */
async function waitForServer() {
  if (server.listening) {
    return;
  }
  return new Promise((resolve) => {
    server.on('listening', resolve);
  });
}

/**
 * Main test runner — executes all 16 unit tests sequentially.
 * Ensures the server is ready before running HTTP-based tests,
 * validates all server robustness features, and properly cleans
 * up after all tests complete.
 */
async function runAllTests() {
  console.log('Running server.js tests...');

  // Ensure the server is ready to accept connections before testing
  await waitForServer();

  // Pre-flight validation: verify gracefulShutdown is exported as a function
  assert.ok(typeof gracefulShutdown === 'function', 'gracefulShutdown must be exported as a function');

  // ========================================
  // Tests 1-7: HTTP Method Handling
  // Validates that all allowed HTTP methods
  // return status 200 as expected.
  // ========================================

  await runTest('Test 1: Normal GET request returns 200', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 2: POST request returns 200', async () => {
    const res = await makeRequest('POST', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 3: PUT request returns 200', async () => {
    const res = await makeRequest('PUT', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 4: DELETE request returns 200', async () => {
    const res = await makeRequest('DELETE', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const res = await makeRequest('OPTIONS', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 6: HEAD request returns 200', async () => {
    const res = await makeRequest('HEAD', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('Test 7: PATCH request returns 200', async () => {
    const res = await makeRequest('PATCH', '/');
    assert.strictEqual(res.statusCode, 200);
  });

  // ========================================
  // Test 8: Content-Type Header Verification
  // Ensures the server responds with the
  // correct Content-Type for all requests.
  // ========================================

  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.headers['content-type'], 'text/plain');
  });

  // ========================================
  // Tests 9-11: Timeout Configuration
  // Validates that server-level timeouts
  // are properly configured to prevent
  // resource exhaustion from slow clients.
  // ========================================

  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000);
  });

  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000);
  });

  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000);
  });

  // ========================================
  // Test 12: Connection Tracking Mechanism
  // Verifies the connections Set exists for
  // tracking active sockets during shutdown.
  // ========================================

  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set instance');
  });

  // ========================================
  // Test 13: Error Event Handler Registration
  // Confirms the server supports error event
  // listener registration via server.on().
  // ========================================

  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Capture current listener count before adding a temporary handler
    const listenerCountBefore = server.listenerCount('error');
    const temporaryHandler = () => {};
    server.on('error', temporaryHandler);
    const listenerCountAfter = server.listenerCount('error');
    // Verify the new listener was successfully registered
    assert.strictEqual(listenerCountAfter, listenerCountBefore + 1);
    // Clean up: remove the temporary handler to avoid side effects
    server.removeListener('error', temporaryHandler);
  });

  // ========================================
  // Tests 14-15: URL Path and Query Handling
  // Validates the server accepts various URL
  // formats including paths and query strings.
  // ========================================

  await runTest('Test 14: Different URL paths are accepted', async () => {
    const res1 = await makeRequest('GET', '/test');
    assert.strictEqual(res1.statusCode, 200);
    const res2 = await makeRequest('GET', '/api/users');
    assert.strictEqual(res2.statusCode, 200);
  });

  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const res = await makeRequest('GET', '/?key=value');
    assert.strictEqual(res.statusCode, 200);
  });

  // ========================================
  // Test 16: Graceful Server Close
  // Must be the LAST test since it stops
  // the server from accepting connections.
  // ========================================

  // Brief delay to ensure all previous request sockets have fully closed
  await new Promise((resolve) => setTimeout(resolve, 100));

  await runTest('Test 16: Server closes gracefully', async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  // ========================================
  // Test Results Summary
  // ========================================

  console.log('\n==================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('==================================================');

  process.exit(failed > 0 ? 1 : 0);
}

// Execute the test suite
runAllTests();
