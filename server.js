/**
 * Robust HTTP Server Implementation
 * 
 * Production-ready HTTP server with error handling, graceful shutdown,
 * input validation, and resource cleanup mechanisms.
 */
const http = require('http');

// Server configuration constants
const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Tracks all active sockets to enable proper cleanup during shutdown
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
const SHUTDOWN_TIMEOUT = 10000;      // 10 seconds force-close timeout

/**
 * HTTP Request Handler
 * Processes incoming HTTP requests with input validation and proper response handling.
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request
 * @param {http.ServerResponse} res - The server response object
 */
const requestHandler = (req, res) => {
  // Input Validation - HTTP Method
  // Validates that the HTTP method is in the allowed whitelist
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // Input Validation - URL Format
  // Validates that the URL is non-empty and starts with '/'
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request: Invalid URL format\n');
    return;
  }

  // Input Validation - URL Length
  // Validates URL doesn't exceed maximum allowed length to prevent DoS
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout configuration
  // Returns 408 Request Timeout if response takes too long
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

  // Successful response - preserving original functionality
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
};

// Create the HTTP server with the request handler
const server = http.createServer(requestHandler);

// Timeout Configuration
// Configure server-level timeouts for resource management
server.requestTimeout = REQUEST_TIMEOUT;      // Time for entire request
server.headersTimeout = HEADERS_TIMEOUT;      // Time to receive headers
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT; // Time to keep idle connections

/**
 * Server Error Event Handler
 * Handles server-level errors such as EADDRINUSE and EACCES.
 * Provides descriptive error messages and exits gracefully.
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
 * Tracks active sockets for graceful shutdown support.
 * Adds new connections to the tracking Set and removes them on close.
 */
server.on('connection', (socket) => {
  // Add socket to tracking Set
  connections.add(socket);
  
  // Remove socket from Set when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful Shutdown Function
 * Stops accepting new connections, waits for existing connections to complete,
 * and force-closes remaining connections after timeout.
 * 
 * @param {string} signal - The signal that triggered the shutdown (for logging)
 */
const gracefulShutdown = (signal) => {
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

  // Force-close timeout
  // If connections don't close naturally within timeout, force-close them
  const forceCloseTimeout = setTimeout(() => {
    console.log(`Forcing close of ${connections.size} remaining connection(s) after ${SHUTDOWN_TIMEOUT / 1000}s timeout...`);
    connections.forEach((socket) => {
      socket.destroy();
    });
    process.exit(0);
  }, SHUTDOWN_TIMEOUT);

  // Ensure the timeout doesn't keep the process running
  forceCloseTimeout.unref();
};

/**
 * Signal Handlers
 * Register handlers for process signals to enable graceful shutdown.
 */

// SIGTERM handler - Typically sent by orchestration systems (Docker, Kubernetes)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// SIGINT handler - Typically sent by user interruption (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Uncaught Exception handler - Catches unexpected synchronous errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  gracefulShutdown('uncaughtException');
});

// Unhandled Rejection handler - Catches unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown('unhandledRejection');
});

/**
 * Server Startup
 * Start listening on the configured hostname and port.
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Module Exports
// Export server components for testing purposes
module.exports = { server, gracefulShutdown, connections };
