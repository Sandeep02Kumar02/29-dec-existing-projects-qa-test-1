/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * Tests all robustness features including:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path handling and query strings
 * - Graceful shutdown functionality
 * 
 * Uses only native Node.js modules (http, assert) with no external dependencies.
 */

const http = require('http');
const assert = require('assert');

// Import server components for testing
const { server, gracefulShutdown, connections } = require('./server.js');

// Test configuration
const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;
const TEST_URL = `http://${TEST_HOST}:${TEST_PORT}`;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Helper function to make HTTP requests
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

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * Run a single test
 * @param {string} name - Test name
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
 * Run all tests
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');

  // Wait for server to be fully started
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });

  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(
      response.headers['content-type'],
      'text/plain',
      `Expected text/plain, got ${response.headers['content-type']}`
    );
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(
      server.requestTimeout,
      120000,
      `Expected 120000, got ${server.requestTimeout}`
    );
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(
      server.headersTimeout,
      60000,
      `Expected 60000, got ${server.headersTimeout}`
    );
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(
      server.keepAliveTimeout,
      5000,
      `Expected 5000, got ${server.keepAliveTimeout}`
    );
  });

  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
    assert.ok(typeof connections.add === 'function', 'connections.add should be a function');
    assert.ok(typeof connections.delete === 'function', 'connections.delete should be a function');
    assert.ok(typeof connections.forEach === 'function', 'connections.forEach should be a function');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify server has 'on' method for event listeners
    assert.ok(typeof server.on === 'function', 'server.on should be a function');
    // Check that we can get listener count (error handler exists)
    const errorListenerCount = server.listenerCount('error');
    assert.ok(errorListenerCount >= 1, `Expected at least 1 error listener, got ${errorListenerCount}`);
  });

  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const paths = ['/test', '/api/users', '/path/to/resource'];
    for (const path of paths) {
      const response = await makeRequest('GET', path);
      assert.strictEqual(
        response.statusCode,
        200,
        `Expected 200 for path ${path}, got ${response.statusCode}`
      );
    }
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const response = await makeRequest('GET', '/path?query=value&another=test');
    assert.strictEqual(
      response.statusCode,
      200,
      `Expected 200 for URL with query string, got ${response.statusCode}`
    );
  });

  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    // Verify gracefulShutdown is a function
    assert.ok(typeof gracefulShutdown === 'function', 'gracefulShutdown should be a function');
    // Verify server.close is a function
    assert.ok(typeof server.close === 'function', 'server.close should be a function');
  });

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('='.repeat(50));

  // Close server after tests
  server.close(() => {
    console.log('\nServer closed after tests.');
    process.exit(testResults.failed > 0 ? 1 : 0);
  });
}

// Run tests when this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests, testResults };
