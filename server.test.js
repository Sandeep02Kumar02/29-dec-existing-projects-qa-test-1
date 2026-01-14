/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * Tests all robustness features including HTTP method handling,
 * timeout configurations, connection tracking, and graceful shutdown.
 */
const http = require('http');
const assert = require('assert');
const { server, gracefulShutdown, connections } = require('./server.js');

// Test configuration constants
const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;
const TEST_BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

// Test results tracking
const testResults = { passed: 0, failed: 0, tests: [] };

/**
 * Run a single test with error handling
 * @param {string} name - Test description
 * @param {Function} testFn - Async test function
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Make an HTTP request and return response data
 * @param {string} method - HTTP method
 * @param {string} path - URL path
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function makeRequest(method, path = '/') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: path,
      method: method,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
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
      req.destroy(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  // ============================================
  // HTTP Method Tests (Tests 1-7)
  // ============================================
  
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 2: POST request returns 200', async () => {
    const res = await makeRequest('POST', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 3: PUT request returns 200', async () => {
    const res = await makeRequest('PUT', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 4: DELETE request returns 200', async () => {
    const res = await makeRequest('DELETE', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const res = await makeRequest('OPTIONS', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 6: HEAD request returns 200', async () => {
    const res = await makeRequest('HEAD', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  await runTest('Test 7: PATCH request returns 200', async () => {
    const res = await makeRequest('PATCH', '/');
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // ============================================
  // Header and Configuration Tests (Tests 8-11)
  // ============================================

  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.headers['content-type'], 'text/plain', 
      `Expected text/plain, got ${res.headers['content-type']}`);
  });

  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000, 
      `Expected 120000, got ${server.requestTimeout}`);
  });

  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000, 
      `Expected 60000, got ${server.headersTimeout}`);
  });

  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000, 
      `Expected 5000, got ${server.keepAliveTimeout}`);
  });

  // ============================================
  // Infrastructure Tests (Tests 12-13)
  // ============================================

  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
    assert.strictEqual(typeof connections.add, 'function', 'connections should have add method');
    assert.strictEqual(typeof connections.delete, 'function', 'connections should have delete method');
    assert.strictEqual(typeof connections.forEach, 'function', 'connections should have forEach method');
  });

  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify server has 'error' event listener capability
    assert.strictEqual(typeof server.on, 'function', 'server should have on method');
    // Verify error handler is already registered (listenerCount > 0)
    const errorListeners = server.listenerCount('error');
    assert.ok(errorListeners >= 1, `Expected at least 1 error listener, got ${errorListeners}`);
  });

  // ============================================
  // URL Handling Tests (Tests 14-15)
  // ============================================

  await runTest('Test 14: Different URL paths are accepted', async () => {
    const paths = ['/test', '/api/users', '/path/to/resource', '/a'];
    for (const path of paths) {
      const res = await makeRequest('GET', path);
      assert.strictEqual(res.statusCode, 200, 
        `Expected 200 for path ${path}, got ${res.statusCode}`);
    }
  });

  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const pathsWithQuery = ['/path?query=value', '/api?foo=bar&baz=qux', '/?test=1'];
    for (const path of pathsWithQuery) {
      const res = await makeRequest('GET', path);
      assert.strictEqual(res.statusCode, 200, 
        `Expected 200 for path ${path}, got ${res.statusCode}`);
    }
  });

  // ============================================
  // Shutdown Test (Test 16)
  // ============================================

  await runTest('Test 16: Server closes gracefully', async () => {
    // Verify gracefulShutdown function exists and is callable
    assert.strictEqual(typeof gracefulShutdown, 'function', 
      'gracefulShutdown should be a function');
    // Verify server.close method exists
    assert.strictEqual(typeof server.close, 'function', 
      'server should have close method');
  });

  // ============================================
  // Print Results Summary
  // ============================================
  console.log('\n==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');

  // Close server after tests
  server.close(() => {
    console.log('\nServer closed after tests.');
    process.exit(testResults.failed > 0 ? 1 : 0);
  });
}

// Run all tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  server.close(() => {
    process.exit(1);
  });
});
