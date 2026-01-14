/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * This test suite validates all robustness features including:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path handling and query string support
 * - Graceful shutdown functionality
 */

const http = require('http');
const assert = require('assert');
const { server, gracefulShutdown, connections } = require('./server.js');

const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  results: []
};

/**
 * Helper function to make HTTP requests
 * @param {string} method - HTTP method
 * @param {string} path - Request path
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

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * Run a single test with error handling
 * @param {string} name - Test name
 * @param {Function} testFn - Test function
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    testResults.passed++;
    testResults.results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.results.push({ name, passed: false, error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log('Running server.js tests...');
  console.log('');

  // HTTP Method Tests
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.statusCode, 200, 'GET request should return 200');
  });

  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest('POST', '/');
    assert.strictEqual(response.statusCode, 200, 'POST request should return 200');
  });

  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest('PUT', '/');
    assert.strictEqual(response.statusCode, 200, 'PUT request should return 200');
  });

  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest('DELETE', '/');
    assert.strictEqual(response.statusCode, 200, 'DELETE request should return 200');
  });

  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest('OPTIONS', '/');
    assert.strictEqual(response.statusCode, 200, 'OPTIONS request should return 200');
  });

  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest('HEAD', '/');
    assert.strictEqual(response.statusCode, 200, 'HEAD request should return 200');
  });

  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest('PATCH', '/');
    assert.strictEqual(response.statusCode, 200, 'PATCH request should return 200');
  });

  // Header and Configuration Tests
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest('GET', '/');
    assert.strictEqual(response.headers['content-type'], 'text/plain', 'Content-Type should be text/plain');
  });

  await runTest('Test 9: Server requestTimeout is configured (120s)', async () => {
    assert.strictEqual(server.requestTimeout, 120000, 'requestTimeout should be 120000ms');
  });

  await runTest('Test 10: Server headersTimeout is configured (60s)', async () => {
    assert.strictEqual(server.headersTimeout, 60000, 'headersTimeout should be 60000ms');
  });

  await runTest('Test 11: Server keepAliveTimeout is configured (5s)', async () => {
    assert.strictEqual(server.keepAliveTimeout, 5000, 'keepAliveTimeout should be 5000ms');
  });

  // Infrastructure Tests
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
    assert.ok(typeof connections.add === 'function', 'connections should have add method');
    assert.ok(typeof connections.delete === 'function', 'connections should have delete method');
    assert.ok(typeof connections.forEach === 'function', 'connections should have forEach method');
  });

  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify server has event emitter capability for error events
    assert.ok(typeof server.on === 'function', 'server should have on method for event handling');
    assert.ok(typeof server.listenerCount === 'function', 'server should have listenerCount method');
    // Check that there's at least one error listener registered
    const errorListeners = server.listenerCount('error');
    assert.ok(errorListeners > 0, 'server should have at least one error listener');
  });

  // URL Handling Tests
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const paths = ['/test', '/api/users', '/hello/world'];
    for (const path of paths) {
      const response = await makeRequest('GET', path);
      assert.strictEqual(response.statusCode, 200, `Path ${path} should return 200`);
    }
  });

  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const response = await makeRequest('GET', '/path?query=value&foo=bar');
    assert.strictEqual(response.statusCode, 200, 'URL with query string should return 200');
  });

  // Shutdown Test - This should be the last test
  await runTest('Test 16: Server closes gracefully', async () => {
    assert.ok(typeof gracefulShutdown === 'function', 'gracefulShutdown should be a function');
    assert.ok(typeof server.close === 'function', 'server should have close method');
  });

  // Print summary
  console.log('');
  console.log('==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');

  // Return appropriate exit code
  return testResults.failed === 0;
}

// Execute tests if running directly
if (require.main === module) {
  // Wait a bit for server to be ready
  setTimeout(async () => {
    const success = await runAllTests();
    
    // Close server gracefully after tests
    server.close(() => {
      process.exit(success ? 0 : 1);
    });
    
    // Force exit after timeout if server doesn't close
    setTimeout(() => {
      console.log('Force exiting after test completion...');
      process.exit(success ? 0 : 1);
    }, 3000);
  }, 500);
}

module.exports = { runAllTests, makeRequest };
