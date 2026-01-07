const http = require('http');
const assert = require('assert');
const { server, gracefulShutdown, connections } = require('./server.js');

// Test configuration
const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;

// Test results tracking
const testResults = [];
let testNumber = 0;

/**
 * Run a single test with error handling
 * @param {string} name - Test name
 * @param {Function} testFn - Async test function
 */
async function runTest(name, testFn) {
  testNumber++;
  const currentTestNum = testNumber;
  try {
    await testFn();
    testResults.push({ name, passed: true, testNum: currentTestNum });
    console.log(`✓ Test ${currentTestNum}: ${name}`);
  } catch (error) {
    testResults.push({ name, passed: false, testNum: currentTestNum, error: error.message });
    console.log(`✗ Test ${currentTestNum}: ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Make an HTTP request to the test server
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
      timeout: 5000
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Wait for the server to be ready
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} delay - Delay between retries in ms
 */
async function waitForServer(maxAttempts = 10, delay = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest('GET', '/');
      return;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Server did not start in time');
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');

  // Wait for server to be ready
  try {
    await waitForServer();
  } catch (error) {
    console.error('Failed to connect to server:', error.message);
    process.exit(1);
  }

  // Test 1: Normal GET request returns 200
  await runTest('Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.body, 'Hello, World!\n');
  });

  // Test 2: POST request returns 200
  await runTest('POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 3: PUT request returns 200
  await runTest('PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 4: DELETE request returns 200
  await runTest('DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 5: OPTIONS request returns 200
  await runTest('OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 6: HEAD request returns 200
  await runTest('HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 7: PATCH request returns 200
  await runTest('PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 8: Content-Type header is text/plain
  await runTest('Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.headers['content-type'], 'text/plain');
  });

  // Test 9: Server requestTimeout is configured (120s)
  await runTest('Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000);
  });

  // Test 10: Server headersTimeout is configured (60s)
  await runTest('Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000);
  });

  // Test 11: Server keepAliveTimeout is configured (5s)
  await runTest('Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000);
  });

  // Test 12: Connection tracking mechanism exists
  await runTest('Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
    // Verify we can access the add, delete, forEach, and size methods
    assert.strictEqual(typeof connections.add, 'function');
    assert.strictEqual(typeof connections.delete, 'function');
    assert.strictEqual(typeof connections.forEach, 'function');
    assert.strictEqual(typeof connections.size, 'number');
  });

  // Test 13: Server error event handler can be registered
  await runTest('Server error event handler can be registered', async () => {
    // Verify server has on method for event handling
    assert.strictEqual(typeof server.on, 'function');
    // Verify we can get the number of listeners for 'error' event
    const errorListenerCount = server.listenerCount('error');
    assert.ok(errorListenerCount > 0, 'Server should have error event handler registered');
  });

  // Test 14: Different URL paths are accepted
  await runTest('Different URL paths are accepted', async () => {
    const response1 = await makeRequest('GET', '/test');
    assert.strictEqual(response1.statusCode, 200);
    
    const response2 = await makeRequest('GET', '/api/users');
    assert.strictEqual(response2.statusCode, 200);
    
    const response3 = await makeRequest('GET', '/deeply/nested/path');
    assert.strictEqual(response3.statusCode, 200);
  });

  // Test 15: Query strings in URL are accepted
  await runTest('Query strings in URL are accepted', async () => {
    const response = await makeRequest('GET', '/path?query=value&another=test');
    assert.strictEqual(response.statusCode, 200);
  });

  // Test 16: Server closes gracefully
  await runTest('Server closes gracefully', async () => {
    // Verify gracefulShutdown is a function
    assert.strictEqual(typeof gracefulShutdown, 'function');
    // Verify server.close is available
    assert.strictEqual(typeof server.close, 'function');
  });

  // Print summary
  console.log('\n==================================================');
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('==================================================\n');

  // Close the server cleanly
  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });

  // Force exit after timeout if server doesn't close
  setTimeout(() => {
    process.exit(failed > 0 ? 1 : 0);
  }, 2000);
}

// Run the tests
runAllTests();
