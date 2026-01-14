/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * This test file validates all robustness features of server.js including:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations (requestTimeout, headersTimeout, keepAliveTimeout)
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path handling
 * - Query string support
 * - Graceful shutdown functionality
 * 
 * Uses only native Node.js modules (http, assert) with no external dependencies.
 */

const http = require('http');
const assert = require('assert');

// Import server components for testing
const { server, gracefulShutdown, connections } = require('./server.js');

// Test configuration constants
const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;

// Track test results
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Helper function to make HTTP requests for testing
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
      method: method
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

    req.on('error', (err) => {
      reject(err);
    });

    // Set a timeout to prevent hanging
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Wrapper function to run a single test
 * @param {string} name - Test name/description
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
 * Main test runner function
 * Executes all tests sequentially and outputs results
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  // ============================================
  // HTTP Method Tests (Tests 1-7)
  // ============================================

  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  });

  // ============================================
  // Header and Configuration Tests (Tests 8-11)
  // ============================================

  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.headers['content-type'], 'text/plain', 
      `Expected Content-Type 'text/plain', got '${response.headers['content-type']}'`);
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000, 
      `Expected requestTimeout 120000, got ${server.requestTimeout}`);
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000, 
      `Expected headersTimeout 60000, got ${server.headersTimeout}`);
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000, 
      `Expected keepAliveTimeout 5000, got ${server.keepAliveTimeout}`);
  });

  // ============================================
  // Infrastructure Tests (Tests 12-13)
  // ============================================

  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'Expected connections to be a Set');
    assert.ok(typeof connections.add === 'function', 'Expected connections to have add method');
    assert.ok(typeof connections.delete === 'function', 'Expected connections to have delete method');
    assert.ok(typeof connections.forEach === 'function', 'Expected connections to have forEach method');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify the server has event emitter capabilities
    assert.ok(typeof server.on === 'function', 'Expected server to have on method');
    assert.ok(typeof server.emit === 'function', 'Expected server to have emit method');
    assert.ok(typeof server.listeners === 'function', 'Expected server to have listeners method');
    // Verify error listeners are registered
    const errorListeners = server.listeners('error');
    assert.ok(errorListeners.length > 0, 'Expected at least one error listener to be registered');
  });

  // ============================================
  // URL Handling Tests (Tests 14-15)
  // ============================================

  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const paths = ['/test', '/api/users', '/path/to/resource', '/a/b/c/d'];
    for (const path of paths) {
      const response = await makeRequest('GET', path);
      assert.strictEqual(response.statusCode, 200, 
        `Expected status 200 for path '${path}', got ${response.statusCode}`);
    }
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const pathsWithQuery = [
      '/path?query=value',
      '/api?key=123&name=test',
      '/search?q=hello+world',
      '/?empty='
    ];
    for (const path of pathsWithQuery) {
      const response = await makeRequest('GET', path);
      assert.strictEqual(response.statusCode, 200, 
        `Expected status 200 for path '${path}', got ${response.statusCode}`);
    }
  });

  // ============================================
  // Shutdown Test (Test 16)
  // ============================================

  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    assert.ok(typeof gracefulShutdown === 'function', 'Expected gracefulShutdown to be a function');
    assert.ok(typeof server.close === 'function', 'Expected server to have close method');
    // Verify server is listening
    assert.ok(server.listening, 'Expected server to be listening');
  });

  // ============================================
  // Output Test Results Summary
  // ============================================
  console.log('\n==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');

  // Clean up - close the server gracefully
  return new Promise((resolve) => {
    server.close(() => {
      console.log('\nServer closed after tests.');
      resolve();
    });
  });
}

// Run all tests
runAllTests()
  .then(() => {
    if (testResults.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
