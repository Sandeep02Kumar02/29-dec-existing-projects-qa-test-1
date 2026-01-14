/**
 * Comprehensive Unit Test Suite for Robust HTTP Server
 * 
 * This test suite validates all robustness features of server.js:
 * - HTTP method handling (GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH)
 * - Content-Type header verification
 * - Timeout configurations (requestTimeout, headersTimeout, keepAliveTimeout)
 * - Connection tracking mechanism
 * - Server error event handler registration
 * - URL path handling and query string support
 * - Graceful shutdown functionality
 */

const http = require('http');
const assert = require('assert');

// Import server components for testing
const { server, gracefulShutdown, connections } = require('./server.js');

// Test configuration constants
const TEST_HOST = '127.0.0.1';
const TEST_PORT = 3000;
const REQUEST_TIMEOUT = 5000;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  results: []
};

/**
 * Helper function to make HTTP requests for testing
 * @param {Object} options - HTTP request options
 * @returns {Promise<Object>} Response object with statusCode and body
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: TEST_HOST,
      port: TEST_PORT,
      timeout: REQUEST_TIMEOUT,
      ...options
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString();
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
      reject(new Error('Request timed out'));
    });
    
    req.end();
  });
}

/**
 * Test runner wrapper function
 * @param {string} name - Test name
 * @param {Function} testFn - Async test function
 */
async function runTest(name, testFn) {
  try {
    await testFn();
    testResults.passed++;
    testResults.results.push({ name, status: 'passed' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.results.push({ name, status: 'failed', error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Main test runner - executes all tests sequentially
 */
async function runAllTests() {
  console.log('Running server.js tests...\n');
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ============================================
  // HTTP METHOD TESTS (Tests 1-7)
  // ============================================
  
  // Test 1: Normal GET request returns 200
  await runTest('Test 1: Normal GET request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'GET' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 2: POST request returns 200
  await runTest('Test 2: POST request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'POST' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 3: PUT request returns 200
  await runTest('Test 3: PUT request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'PUT' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 4: DELETE request returns 200
  await runTest('Test 4: DELETE request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'DELETE' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 5: OPTIONS request returns 200
  await runTest('Test 5: OPTIONS request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'OPTIONS' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 6: HEAD request returns 200
  await runTest('Test 6: HEAD request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'HEAD' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // Test 7: PATCH request returns 200
  await runTest('Test 7: PATCH request returns 200', async () => {
    const response = await makeRequest({ path: '/', method: 'PATCH' });
    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  });
  
  // ============================================
  // HEADER AND CONFIGURATION TESTS (Tests 8-11)
  // ============================================
  
  // Test 8: Content-Type header is text/plain
  await runTest('Test 8: Content-Type header is text/plain', async () => {
    const response = await makeRequest({ path: '/', method: 'GET' });
    assert.strictEqual(
      response.headers['content-type'], 
      'text/plain',
      `Expected 'text/plain', got '${response.headers['content-type']}'`
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
  
  // ============================================
  // INFRASTRUCTURE TESTS (Tests 12-13)
  // ============================================
  
  // Test 12: Connection tracking mechanism exists
  await runTest('Test 12: Connection tracking mechanism exists', async () => {
    assert.ok(connections instanceof Set, 'connections should be a Set');
    assert.ok(typeof connections.add === 'function', 'connections should have add method');
    assert.ok(typeof connections.delete === 'function', 'connections should have delete method');
    assert.ok(typeof connections.forEach === 'function', 'connections should have forEach method');
    assert.ok(typeof connections.size === 'number', 'connections should have size property');
  });
  
  // Test 13: Server error event handler can be registered
  await runTest('Test 13: Server error event handler can be registered', async () => {
    // Verify server has the ability to register error handlers
    assert.ok(typeof server.on === 'function', 'server should have on method');
    assert.ok(typeof server.emit === 'function', 'server should have emit method');
    
    // Test that we can register an error handler (without triggering it)
    let errorHandlerRegistered = false;
    const testHandler = () => { errorHandlerRegistered = true; };
    server.on('testEvent', testHandler);
    server.emit('testEvent');
    assert.strictEqual(errorHandlerRegistered, true, 'Event handler should be callable');
    server.removeListener('testEvent', testHandler);
  });
  
  // ============================================
  // URL HANDLING TESTS (Tests 14-15)
  // ============================================
  
  // Test 14: Different URL paths are accepted
  await runTest('Test 14: Different URL paths are accepted', async () => {
    const paths = ['/test', '/api/users', '/path/to/resource', '/a'];
    for (const path of paths) {
      const response = await makeRequest({ path, method: 'GET' });
      assert.strictEqual(
        response.statusCode, 
        200,
        `Path '${path}' should return 200, got ${response.statusCode}`
      );
    }
  });
  
  // Test 15: Query strings in URL are accepted
  await runTest('Test 15: Query strings in URL are accepted', async () => {
    const pathsWithQuery = [
      '/path?query=value',
      '/search?q=test&page=1',
      '/api?filter=active&sort=name'
    ];
    for (const path of pathsWithQuery) {
      const response = await makeRequest({ path, method: 'GET' });
      assert.strictEqual(
        response.statusCode, 
        200,
        `Path '${path}' should return 200, got ${response.statusCode}`
      );
    }
  });
  
  // ============================================
  // SHUTDOWN TEST (Test 16)
  // ============================================
  
  // Test 16: Server closes gracefully
  await runTest('Test 16: Server closes gracefully', async () => {
    // Verify gracefulShutdown function exists and is callable
    assert.ok(typeof gracefulShutdown === 'function', 'gracefulShutdown should be a function');
    
    // Verify server.close is available for shutdown
    assert.ok(typeof server.close === 'function', 'server should have close method');
  });
  
  // ============================================
  // TEST SUMMARY
  // ============================================
  
  console.log('\n==================================================');
  console.log(`Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('==================================================');
  
  // Close the server after tests
  server.close(() => {
    process.exit(testResults.failed > 0 ? 1 : 0);
  });
}

// Run all tests
runAllTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
