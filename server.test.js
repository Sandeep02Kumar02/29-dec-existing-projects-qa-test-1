const http = require('http');
const assert = require('assert');
const { server, gracefulShutdown } = require('./server.js');

// Test infrastructure - tracks pass/fail counts and stores result messages
let passed = 0;
let failed = 0;
const results = [];
const TEST_PORT = 3000;
const TEST_HOST = '127.0.0.1';

/**
 * Makes an HTTP request to the test server and returns a promise
 * that resolves with the response status code, headers, and body.
 * Used by individual test cases to verify HTTP behavior.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
 * @param {string} path - URL path to request (e.g., '/', '/test', '/search?q=test')
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: path || '/',
      method: method || 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Runs a single test case with error handling and result tracking.
 * Catches assertion failures and records pass/fail status with descriptive messages.
 * @param {number} testNumber - Sequential test number (1-16)
 * @param {string} description - Human-readable test description for output
 * @param {Function} testFn - Async test function containing assertions to execute
 */
async function runTest(testNumber, description, testFn) {
  try {
    await testFn();
    passed++;
    results.push(`\u2713 Test ${testNumber}: ${description}`);
  } catch (error) {
    failed++;
    results.push(`\u2717 Test ${testNumber}: ${description} - ${error.message}`);
  }
}

/**
 * Waits for the server to be ready to accept connections.
 * Handles the case where the server may already be listening
 * when the module is imported, or waits for the 'listening' event.
 * @returns {Promise<void>}
 */
function waitForServer() {
  return new Promise((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.once('listening', resolve);
    }
  });
}

/**
 * Main test execution function. Runs all 16 test cases sequentially,
 * verifying HTTP method handling, Content-Type headers, timeout configuration,
 * connection tracking, error event handling, URL processing, and graceful shutdown.
 * Prints a formatted summary of results and exits with appropriate code.
 */
async function runAllTests() {
  console.log('Running server.js tests...');

  // Wait for server to be ready before running any tests
  await waitForServer();

  // Test 1: Normal GET request returns 200 status code
  await runTest(1, 'Normal GET request returns 200', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 2: POST request returns 200 status code
  await runTest(2, 'POST request returns 200', async () => {
    const res = await makeRequest('POST', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 3: PUT request returns 200 status code
  await runTest(3, 'PUT request returns 200', async () => {
    const res = await makeRequest('PUT', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 4: DELETE request returns 200 status code
  await runTest(4, 'DELETE request returns 200', async () => {
    const res = await makeRequest('DELETE', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 5: OPTIONS request returns 200 status code
  await runTest(5, 'OPTIONS request returns 200', async () => {
    const res = await makeRequest('OPTIONS', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 6: HEAD request returns 200 status code
  // Note: HEAD responses have no body per HTTP spec; only status code is verified
  await runTest(6, 'HEAD request returns 200', async () => {
    const res = await makeRequest('HEAD', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 7: PATCH request returns 200 status code
  await runTest(7, 'PATCH request returns 200', async () => {
    const res = await makeRequest('PATCH', '/');
    assert.strictEqual(res.statusCode, 200, `Expected status 200 but got ${res.statusCode}`);
  });

  // Test 8: Content-Type header is text/plain
  // Verifies the server sets the correct Content-Type for all responses
  await runTest(8, 'Content-Type header is text/plain', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(
      res.headers['content-type'],
      'text/plain',
      `Expected Content-Type text/plain but got ${res.headers['content-type']}`
    );
  });

  // Test 9: Server requestTimeout is configured (120s)
  // Validates the complete request timeout is set to 120000ms (2 minutes)
  await runTest(9, 'Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(
      server.requestTimeout,
      120000,
      `Expected requestTimeout 120000 but got ${server.requestTimeout}`
    );
  });

  // Test 10: Server headersTimeout is configured (60s)
  // Validates the headers reception timeout is set to 60000ms (60 seconds)
  await runTest(10, 'Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(
      server.headersTimeout,
      60000,
      `Expected headersTimeout 60000 but got ${server.headersTimeout}`
    );
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  // Validates the keep-alive idle timeout is set to 5000ms (5 seconds)
  await runTest(11, 'Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(
      server.keepAliveTimeout,
      5000,
      `Expected keepAliveTimeout 5000 but got ${server.keepAliveTimeout}`
    );
  });

  // Test 12: Connection tracking mechanism exists
  // Verifies the server has a 'connection' event listener that tracks active sockets
  // in a Set for cleanup during graceful shutdown
  await runTest(12, 'Connection tracking mechanism exists', async () => {
    const connectionListeners = server.listenerCount('connection');
    assert.ok(
      connectionListeners > 0,
      'Server should have at least one connection event listener for socket tracking'
    );
  });

  // Test 13: Server error event handler can be registered
  // Verifies the server has an 'error' event handler to prevent unhandled exception crashes
  // on startup failures like EADDRINUSE or EACCES
  await runTest(13, 'Server error event handler can be registered', async () => {
    const errorListeners = server.listenerCount('error');
    assert.ok(
      errorListeners > 0,
      'Server should have at least one error event handler registered'
    );
  });

  // Test 14: Different URL paths are accepted
  // Verifies the server handles various URL paths correctly and returns 200
  await runTest(14, 'Different URL paths are accepted', async () => {
    const res1 = await makeRequest('GET', '/test');
    assert.strictEqual(res1.statusCode, 200, `Expected 200 for /test but got ${res1.statusCode}`);

    const res2 = await makeRequest('GET', '/api/data');
    assert.strictEqual(res2.statusCode, 200, `Expected 200 for /api/data but got ${res2.statusCode}`);
  });

  // Test 15: Query strings in URL are accepted
  // Verifies the server properly handles URLs with query parameters
  await runTest(15, 'Query strings in URL are accepted', async () => {
    const res = await makeRequest('GET', '/search?q=test');
    assert.strictEqual(
      res.statusCode,
      200,
      `Expected 200 for /search?q=test but got ${res.statusCode}`
    );
  });

  // Test 16: Server closes gracefully
  // Tests the gracefulShutdown function by calling it and verifying the server stops
  // listening. Temporarily overrides process.exit to prevent test process termination.
  await runTest(16, 'Server closes gracefully', async () => {
    // Temporarily override process.exit to prevent actual termination during test
    const originalExit = process.exit;
    try {
      process.exit = () => {
        // Intentionally empty - prevents actual process termination during test
      };

      // Call gracefulShutdown and wait for the server 'close' event
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Graceful shutdown timed out after 5 seconds'));
        }, 5000);

        server.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });

        gracefulShutdown();
      });

      // Verify the server is no longer listening after graceful shutdown
      assert.strictEqual(
        server.listening,
        false,
        'Server should no longer be listening after graceful shutdown'
      );
    } finally {
      // Always restore the original process.exit function
      process.exit = originalExit;
    }
  });

  // Print all test results with checkmarks for pass and crosses for fail
  console.log('');
  results.forEach((result) => {
    console.log(result);
  });
  console.log('');
  console.log('==================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('==================================================');

  // Exit with code 0 if all tests passed, 1 if any failed
  process.exit(failed > 0 ? 1 : 0);
}

// Execute all tests
runAllTests();
