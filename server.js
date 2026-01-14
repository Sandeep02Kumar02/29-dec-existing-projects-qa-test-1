/**
 * Robust HTTP Server Implementation
 * 
 * Features:
 * - Error handling for server startup failures (EADDRINUSE, EACCES)
 * - Graceful shutdown with connection tracking
 * - Input validation (HTTP method, URL format, URL length)
 * - Timeout configuration to prevent resource exhaustion
 * - Signal handlers for proper process termination
 */

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Stores all active socket connections to enable force-close during shutdown
const connections = new Set();

// Whitelist of allowed HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks via long URIs
const MAX_URL_LENGTH = 2048;

// Timeout constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;    // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;     // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000;   // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;    // 30 seconds per-response timeout
const SHUTDOWN_TIMEOUT = 10000;    // 10 seconds grace period for shutdown

/**
 * HTTP request handler with input validation
 * Validates HTTP method, URL format, and URL length before processing
 */
const server = http.createServer((req, res) => {
  // Input validation - HTTP method whitelist
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // Input validation - URL format must start with '/'
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request: Invalid URL format\n');
    return;
  }

  // Input validation - URL length limit to prevent DoS
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout to prevent slow response attacks
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, RESPONSE_TIMEOUT);

  // Clear timeout when response finishes
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  res.on('close', () => {
    clearTimeout(responseTimeout);
  });

  // Successful response - preserved from original implementation
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Configure server timeouts to prevent resource exhaustion
// requestTimeout: Maximum time for the entire request (headers + body)
server.requestTimeout = REQUEST_TIMEOUT;

// headersTimeout: Maximum time allowed for receiving HTTP headers
server.headersTimeout = HEADERS_TIMEOUT;

// keepAliveTimeout: Time to wait for additional requests on keep-alive connections
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;

/**
 * Server error event handler
 * Handles common server startup errors gracefully instead of crashing
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the process using this port.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try using a port number above 1024 or run with elevated privileges.`);
    process.exit(1);
  } else {
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

/**
 * Connection tracking for graceful shutdown
 * Tracks all active socket connections to enable proper cleanup during shutdown
 */
server.on('connection', (socket) => {
  // Add socket to tracking set
  connections.add(socket);

  // Remove socket from tracking when connection closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful shutdown function
 * Stops accepting new connections and waits for existing ones to complete
 * Forces close after timeout to ensure process termination
 */
function gracefulShutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err.message);
      process.exit(1);
    }
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Force close connections after timeout
  const forceCloseTimeout = setTimeout(() => {
    console.log(`Forcing close after ${SHUTDOWN_TIMEOUT / 1000} seconds timeout...`);
    connections.forEach((socket) => {
      socket.destroy();
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Prevent timeout from keeping process alive if all connections close naturally
  forceCloseTimeout.unref();
}

/**
 * Signal handlers for graceful shutdown
 * SIGTERM: Sent by orchestration systems (Docker, Kubernetes, etc.)
 * SIGINT: Sent by user interruption (Ctrl+C)
 */
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

/**
 * Uncaught exception handler
 * Logs unexpected errors and exits gracefully
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  gracefulShutdown('uncaughtException');
});

/**
 * Unhandled promise rejection handler
 * Logs unhandled promise rejections and exits gracefully
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Export for testing
module.exports = { server, gracefulShutdown, connections };
