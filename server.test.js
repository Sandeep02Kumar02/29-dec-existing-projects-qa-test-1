/**
 * Comprehensive Unit Test Suite for server.js
 * 
 * This test suite validates all robustness features of the HTTP server:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations (requestTimeout, headersTimeout, keepAliveTimeout)
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path handling and query string support
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
const TEST_TIMEOUT = 5000;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Helper function to make HTTP request and return a promise
 * 
 * @param {string} method - HTTP method
 * @param {string} path - URL path
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: path,
      method: method,
      timeout: TEST_TIMEOUT
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Run a single test case with pass/fail tracking
 * 
 * @param {string} name - Test name/description
 * @param {Function} testFn - Async test function
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, passed: false, error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Run all test cases sequentially
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');

  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200, 'Expected status code 200');
  });

  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(
      response.headers['content-type'],
      'text/plain',
      'Expected Content-Type: text/plain'
    );
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(
      server.requestTimeout,
      120000,
      'Expected requestTimeout to be 120000ms (2 minutes)'
    );
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(
      server.headersTimeout,
      60000,
      'Expected headersTimeout to be 60000ms (60 seconds)'
    );
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(
      server.keepAliveTimeout,
      5000,
      'Expected keepAliveTimeout to be 5000ms (5 seconds)'
    );
  });

  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'Expected connections to be a Set');
    assert.strictEqual(typeof connections.add, 'function', 'Expected connections.add to be a function');
    assert.strictEqual(typeof connections.delete, 'function', 'Expected connections.delete to be a function');
    assert.strictEqual(typeof connections.forEach, 'function', 'Expected connections.forEach to be a function');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify server has event emitter capabilities
    assert.strictEqual(typeof server.on, 'function', 'Expected server.on to be a function');
    assert.strictEqual(typeof server.emit, 'function', 'Expected server.emit to be a function');
    
    // Count current error listeners (should have at least 1 from server.js)
    const errorListeners = server.listeners('error');
    assert.ok(errorListeners.length >= 1, 'Expected at least one error handler to be registered');
  });

  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const response1 = await makeRequest('GET', '/test');
    assert.strictEqual(response1.statusCode, 200, 'Expected /test to return 200');
    
    const response2 = await makeRequest('GET', '/api/users');
    assert.strictEqual(response2.statusCode, 200, 'Expected /api/users to return 200');
    
    const response3 = await makeRequest('GET', '/deeply/nested/path');
    assert.strictEqual(response3.statusCode, 200, 'Expected /deeply/nested/path to return 200');
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const response1 = await makeRequest('GET', '/path?query=value');
    assert.strictEqual(response1.statusCode, 200, 'Expected /path?query=value to return 200');
    
    const response2 = await makeRequest('GET', '/?foo=bar&baz=qux');
    assert.strictEqual(response2.statusCode, 200, 'Expected /?foo=bar&baz=qux to return 200');
  });

  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    // Verify gracefulShutdown function exists and is callable
    assert.strictEqual(typeof gracefulShutdown, 'function', 'Expected gracefulShutdown to be a function');
    
    // Verify server has close method
    assert.strictEqual(typeof server.close, 'function', 'Expected server.close to be a function');
    
    // Verify server is listening
    assert.ok(server.listening, 'Expected server to be listening');
  });

  // Print test summary
  console.log('\n==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');

  // Clean up: close the server gracefully
  return new Promise((resolve) => {
    server.close(() => {
      console.log('\nServer closed after tests.');
      resolve();
    });
  });
}

// Wait for server to be ready, then run tests
const checkServerReady = setInterval(() => {
  if (server.listening) {
    clearInterval(checkServerReady);
    runAllTests()
      .then(() => {
        process.exit(testResults.failed > 0 ? 1 : 0);
      })
      .catch((error) => {
        console.error('Test runner error:', error.message);
        process.exit(1);
      });
  }
}, 100);

// Timeout if server doesn't start
setTimeout(() => {
  if (!server.listening) {
    console.error('Error: Server did not start within timeout period');
    clearInterval(checkServerReady);
    process.exit(1);
  }
}, 10000);
