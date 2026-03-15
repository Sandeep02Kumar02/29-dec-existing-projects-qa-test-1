/**
 * Comprehensive unit test suite for server.js
 * Tests all robustness features: error handling, graceful shutdown,
 * input validation, timeout configuration, and connection tracking.
 *
 * Uses only Node.js built-in modules (http, assert) - no external dependencies.
 *
 * Run with: node server.test.js
 */

const http = require('http');
const assert = require('assert');

let server;
let testsPassed = 0;
let testsFailed = 0;
const totalTests = 16;

/**
 * Helper function to make HTTP requests to the test server.
 * Returns a promise that resolves with { statusCode, headers, body }.
 * @param {Object} options - http.request options
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}

/**
 * Runs a single test case and tracks pass/fail status.
 * @param {string} name - Descriptive test name
 * @param {Function} fn - Async test function
 */
async function runTest(name, fn) {
  try {
    await fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
  }
}

/**
 * Main test runner - imports server module, runs all 16 tests sequentially,
 * and reports results.
 */
async function runAllTests() {
  console.log('Running server.js tests...');

  // Import the server module (this starts the server listening)
  const serverModule = require('./server.js');
  server = serverModule.server;

  // Wait for the server to be fully ready before running tests
  await new Promise((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.on('listening', resolve);
    }
  });

  const baseOptions = {
    hostname: '127.0.0.1',
    port: 3000,
  };

  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'GET', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert.strictEqual(res.body, 'Hello, World!\n', `Expected "Hello, World!\\n", got "${res.body}"`);
  });

  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'POST', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'PUT', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'DELETE', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'OPTIONS', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'HEAD', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'PATCH', path: '/' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  });

  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'GET', path: '/' });
    assert.strictEqual(
      res.headers['content-type'],
      'text/plain',
      `Expected "text/plain", got "${res.headers['content-type']}"`
    );
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(
      server.requestTimeout,
      120000,
      `Expected requestTimeout 120000, got ${server.requestTimeout}`
    );
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(
      server.headersTimeout,
      60000,
      `Expected headersTimeout 60000, got ${server.headersTimeout}`
    );
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(
      server.keepAliveTimeout,
      5000,
      `Expected keepAliveTimeout 5000, got ${server.keepAliveTimeout}`
    );
  });

  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    const { connections } = serverModule;
    assert.ok(connections instanceof Set, 'connections should be a Set instance');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify that the server has at least one 'error' event listener registered
    const errorListenerCount = server.listenerCount('error');
    assert.ok(
      errorListenerCount > 0,
      `Expected at least 1 error listener, got ${errorListenerCount}`
    );
  });

  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'GET', path: '/some/path' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert.strictEqual(res.body, 'Hello, World!\n', `Expected "Hello, World!\\n", got "${res.body}"`);
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const res = await makeRequest({ ...baseOptions, method: 'GET', path: '/?key=value&foo=bar' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert.strictEqual(res.body, 'Hello, World!\n', `Expected "Hello, World!\\n", got "${res.body}"`);
  });

  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(new Error(`Server close failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
    assert.strictEqual(server.listening, false, 'Server should not be listening after close');
  });

  // Print results summary
  console.log('');
  console.log('==================================================');
  console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('==================================================');

  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Execute test suite
runAllTests().catch((err) => {
  console.error('Test suite failed to run:', err.message);
  process.exit(1);
});
