/**
 * Robust HTTP Server Implementation
 * 
 * This server includes comprehensive error handling, graceful shutdown,
 * input validation, timeout configuration, and connection tracking for
 * production-ready deployment.
 */

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Maintains a Set of all active socket connections to enable proper cleanup
const connections = new Set();

// Allowed HTTP methods whitelist for input validation
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks via excessively long URIs
const MAX_URL_LENGTH = 2048;

// Timeout constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;      // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;       // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000;     // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;      // 30 seconds per-response timeout
const SHUTDOWN_TIMEOUT = 10000;      // 10 seconds grace period for shutdown

/**
 * HTTP Server instance with request validation and response handling
 */
const server = http.createServer((req, res) => {
  // Input Validation - HTTP Method
  // Validates that the request method is in the allowed whitelist
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('405 Method Not Allowed\n');
    return;
  }

  // Input Validation - URL Format
  // Validates that the URL is non-empty and starts with '/'
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('400 Bad Request\n');
    return;
  }

  // Input Validation - URL Length
  // Prevents DoS attacks via excessively long URIs
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('414 URI Too Long\n');
    return;
  }

  // Per-response timeout handling
  // Returns 408 Request Timeout if response takes longer than RESPONSE_TIMEOUT
  const responseTimer = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('408 Request Timeout\n');
    }
  }, RESPONSE_TIMEOUT);

  // Clear the timeout when response finishes
  res.on('finish', () => {
    clearTimeout(responseTimer);
  });

  // Clear the timeout if response is closed prematurely
  res.on('close', () => {
    clearTimeout(responseTimer);
  });

  // Standard successful response - preserved from original implementation
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Configure server timeouts
// requestTimeout: Maximum time for the entire request to complete
server.requestTimeout = REQUEST_TIMEOUT;

// headersTimeout: Maximum time to receive request headers
server.headersTimeout = HEADERS_TIMEOUT;

// keepAliveTimeout: Time to wait for additional requests on keep-alive connections
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;

/**
 * Server Error Event Handler
 * Handles server-level errors such as EADDRINUSE and EACCES
 * Prevents unhandled exception crashes during server startup
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the existing process.`);
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
 * Connection Tracking
 * Tracks active socket connections to enable proper cleanup during shutdown
 * Each new connection is added to the Set, and removed when the socket closes
 */
server.on('connection', (socket) => {
  // Add socket to the connections Set for tracking
  connections.add(socket);
  
  // Remove socket from Set when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful Shutdown Function
 * Stops accepting new connections and waits for existing connections to complete
 * Force-closes remaining connections after SHUTDOWN_TIMEOUT if necessary
 * 
 * @returns {void}
 */
function gracefulShutdown() {
  console.log('Starting graceful shutdown...');
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error(`Error during server close: ${err.message}`);
      process.exit(1);
    }
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Force-close connections after timeout if they haven't closed gracefully
  const forceCloseTimer = setTimeout(() => {
    console.log(`Forcing close of ${connections.size} remaining connection(s) after ${SHUTDOWN_TIMEOUT / 1000}s timeout...`);
    
    // Destroy all remaining active connections
    connections.forEach((socket) => {
      socket.destroy();
    });
    
    // Clear the connections Set
    connections.clear();
    
    console.log('Forced shutdown complete.');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT);

  // Prevent the timer from keeping the process alive if server closes gracefully first
  forceCloseTimer.unref();
}

/**
 * SIGTERM Signal Handler
 * Triggered by orchestration/deployment shutdowns (e.g., Kubernetes, Docker)
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  gracefulShutdown();
});

/**
 * SIGINT Signal Handler
 * Triggered by user interruption (Ctrl+C)
 */
process.on('SIGINT', () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  gracefulShutdown();
});

/**
 * Uncaught Exception Handler
 * Catches unexpected synchronous errors that weren't handled
 * Logs the error and initiates graceful shutdown
 */
process.on('uncaughtException', (error) => {
  console.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  gracefulShutdown();
});

/**
 * Unhandled Rejection Handler
 * Catches promise rejections that weren't handled
 * Logs the error and initiates graceful shutdown
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown();
});

/**
 * Start the server
 * Listens on the configured hostname and port
 * Logs server startup information - preserved from original implementation
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Module exports for testing
// Exports server instance, gracefulShutdown function, and connections Set
module.exports = { server, gracefulShutdown, connections };
