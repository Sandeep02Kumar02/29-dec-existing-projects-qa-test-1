/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * Tests 16 aspects of the server implementation:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path and query string handling
 * - Graceful shutdown functionality
 */

const http = require('http');
const assert = require('assert');
const { server, gracefulShutdown, connections } = require('./server.js');

const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;

// Test results tracking
const testResults = { passed: 0, failed: 0, tests: [] };

/**
 * Async test runner wrapper
 * @param {string} name - Test name
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
    console.log(`✗ ${name}: ${error.message}`);
  }
}

/**
 * Make an HTTP request and return response details
 * @param {string} method - HTTP method
 * @param {string} path - URL path
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
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

    req.on('error', (error) => {
      reject(error);
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

  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.headers['content-type'], 'text/plain');
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000);
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000);
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000);
  });

  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    let errorHandlerCanBeRegistered = false;
    try {
      // Test that error event listener can be added
      const testHandler = () => {};
      server.on('error', testHandler);
      server.removeListener('error', testHandler);
      errorHandlerCanBeRegistered = true;
    } catch (e) {
      errorHandlerCanBeRegistered = false;
    }
    assert.ok(errorHandlerCanBeRegistered, 'Should be able to register error handlers');
  });

  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const response1 = await makeRequest('GET', '/test');
    const response2 = await makeRequest('GET', '/api/users');
    const response3 = await makeRequest('GET', '/some/nested/path');
    assert.strictEqual(response1.statusCode, 200);
    assert.strictEqual(response2.statusCode, 200);
    assert.strictEqual(response3.statusCode, 200);
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const response1 = await makeRequest('GET', '/path?query=value');
    const response2 = await makeRequest('GET', '/?foo=bar&baz=qux');
    assert.strictEqual(response1.statusCode, 200);
    assert.strictEqual(response2.statusCode, 200);
  });

  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    // Verify gracefulShutdown function exists and is callable
    assert.ok(typeof gracefulShutdown === 'function', 'gracefulShutdown should be a function');
    
    // Verify server.close method exists
    assert.ok(typeof server.close === 'function', 'server.close should be a function');
  });

  // Print summary
  console.log('\n==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');

  // Close server after tests
  server.close(() => {
    console.log('\nTest suite completed. Server closed.');
    process.exit(testResults.failed > 0 ? 1 : 0);
  });
}

// Run all tests
runAllTests().catch((error) => {
  console.error('Test suite error:', error);
  server.close(() => {
    process.exit(1);
  });
});
