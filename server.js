/**
 * Robust HTTP Server Implementation
 * 
 * This module provides a production-ready HTTP server with:
 * - Error handling for server startup failures (EADDRINUSE, EACCES)
 * - Graceful shutdown on SIGTERM/SIGINT signals
 * - Input validation for HTTP methods, URL format, and URL length
 * - Timeout configuration to prevent resource exhaustion
 * - Connection tracking for clean shutdown
 */

const http = require('http');

// Server configuration constants - preserved from original
const hostname = '127.0.0.1';
const port = 3000;

// Maximum allowed URL length (protects against DoS via long URIs)
const MAX_URL_LENGTH = 2048;

// Timeout constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;  // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;   // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000; // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;  // 30 seconds per-response timeout
const GRACEFUL_SHUTDOWN_TIMEOUT = 10000; // 10 seconds force-close timeout

// Allowed HTTP methods whitelist
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Connection tracking for graceful shutdown
const connections = new Set();

// Flag to track if shutdown is in progress
let isShuttingDown = false;

/**
 * Creates the HTTP server with request handling and input validation
 */
const server = http.createServer((req, res) => {
  // Input Validation - HTTP Method
  // Validate that the HTTP method is in the allowed whitelist
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // Input Validation - URL Format
  // Validate that URL is non-empty and starts with '/'
  if (!req.url || req.url.length === 0 || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request: Invalid URL format\n');
    return;
  }

  // Input Validation - URL Length
  // Validate that URL doesn't exceed maximum allowed length
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout handling
  // Returns 408 Request Timeout if response takes too long
  const responseTimer = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, RESPONSE_TIMEOUT);

  // Clear timeout when response finishes
  res.on('finish', () => {
    clearTimeout(responseTimer);
  });

  // Clear timeout if connection closes unexpectedly
  res.on('close', () => {
    clearTimeout(responseTimer);
  });

  // Normal response handling - preserved from original
  // Returns "Hello, World!\n" with status 200 and Content-Type: text/plain
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Server Timeout Configuration
// These timeouts protect against slow clients and resource exhaustion
server.requestTimeout = REQUEST_TIMEOUT;   // Time allowed for entire request
server.headersTimeout = HEADERS_TIMEOUT;   // Time allowed for receiving headers
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT; // Idle time before closing keep-alive connections

/**
 * Server Error Event Handler
 * Handles server-level errors to prevent unhandled exception crashes
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // Port is already in use by another process
    console.error(`Error: Port ${port} is already in use. Please stop the other process or use a different port.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    // Permission denied (e.g., trying to bind to port < 1024 without root)
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try using a port number above 1024.`);
    process.exit(1);
  } else {
    // Generic server error handling
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

/**
 * Connection Tracking
 * Tracks active socket connections to enable graceful shutdown
 */
server.on('connection', (socket) => {
  // Add socket to tracking set
  connections.add(socket);
  
  // Remove socket from tracking set when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful Shutdown Function
 * Stops accepting new connections and waits for existing connections to complete
 * Force-closes remaining connections after timeout
 * 
 * @returns {void}
 */
function gracefulShutdown() {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log('SIGTERM received. Starting graceful shutdown...');

  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Force-close connections after timeout if they don't close gracefully
  const forceCloseTimer = setTimeout(() => {
    console.log(`Force-closing ${connections.size} remaining connection(s) after timeout...`);
    
    // Destroy all remaining sockets
    connections.forEach((socket) => {
      socket.destroy();
    });
    
    console.log('Server closed. All connections handled.');
    process.exit(0);
  }, GRACEFUL_SHUTDOWN_TIMEOUT);

  // Don't keep the process alive just for this timer
  forceCloseTimer.unref();
}

/**
 * Signal Handlers
 * Handle process signals for graceful shutdown
 */

// SIGTERM handler - typically sent by orchestration systems (Kubernetes, Docker, PM2)
process.on('SIGTERM', () => {
  gracefulShutdown();
});

// SIGINT handler - sent when user presses Ctrl+C
process.on('SIGINT', () => {
  console.log('SIGINT received (Ctrl+C). Starting graceful shutdown...');
  gracefulShutdown();
});

// Uncaught Exception handler - catches unexpected synchronous errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  gracefulShutdown();
});

// Unhandled Rejection handler - catches unhandled Promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown();
});

/**
 * Start the server
 * Listens on the configured hostname and port
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

/**
 * Module Exports
 * Export server components for testing
 */
module.exports = { server, gracefulShutdown, connections };
