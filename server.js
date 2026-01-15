/**
 * Robust HTTP Server Implementation
 * 
 * This module provides a production-ready HTTP server with:
 * - Error event handling for startup failures (EADDRINUSE, EACCES)
 * - Graceful shutdown with connection tracking
 * - Input validation for HTTP methods, URL format, and URL length
 * - Configurable timeouts to prevent resource exhaustion
 * 
 * @module server
 */

const http = require('http');

// Server configuration constants
const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Stores active socket connections to enable proper cleanup during shutdown
const connections = new Set();

// Valid HTTP methods whitelist for input validation
const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks via excessively long URIs
const MAX_URL_LENGTH = 2048;

// Timeout configuration constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;    // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;     // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000;   // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;    // 30 seconds per-response timeout
const SHUTDOWN_TIMEOUT = 10000;    // 10 seconds for graceful shutdown

/**
 * HTTP Request Handler
 * 
 * Processes incoming HTTP requests with input validation before
 * sending the response. Includes per-request timeout handling.
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request
 * @param {http.ServerResponse} res - The HTTP response object
 */
const requestHandler = (req, res) => {
  // Input Validation - HTTP Method
  // Validates that the request method is in our whitelist of allowed methods
  if (!VALID_HTTP_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', VALID_HTTP_METHODS.join(', '));
    res.end('405 Method Not Allowed\n');
    return;
  }

  // Input Validation - URL Format
  // Validates that the URL exists and starts with '/' as required by HTTP spec
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('400 Bad Request: Invalid URL format\n');
    return;
  }

  // Input Validation - URL Length
  // Prevents DoS attacks via excessively long URLs
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('414 URI Too Long\n');
    return;
  }

  // Per-response timeout configuration
  // Returns 408 Request Timeout if response takes too long
  const responseTimer = setTimeout(() => {
    if (!res.writableEnded) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('408 Request Timeout\n');
    }
  }, RESPONSE_TIMEOUT);

  // Clear the response timer when the response finishes
  res.on('finish', () => {
    clearTimeout(responseTimer);
  });

  // Clear the response timer if the connection closes prematurely
  res.on('close', () => {
    clearTimeout(responseTimer);
  });

  // Successful response - preserved from original implementation
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
};

// Create the HTTP server with the request handler
const server = http.createServer(requestHandler);

// Configure server timeouts to prevent resource exhaustion
// requestTimeout: Maximum time for receiving the entire request from the client
server.requestTimeout = REQUEST_TIMEOUT;

// headersTimeout: Maximum time for receiving HTTP headers
server.headersTimeout = HEADERS_TIMEOUT;

// keepAliveTimeout: Time to wait for additional requests on keep-alive connections
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;

/**
 * Server Error Event Handler
 * 
 * Handles server-level errors during startup and operation.
 * Provides descriptive error messages and graceful exit.
 * 
 * @param {Error} error - The error object with a code property
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try running with elevated privileges or use a port > 1024.`);
    process.exit(1);
  } else {
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

/**
 * Connection Tracking Handler
 * 
 * Tracks active socket connections to enable proper cleanup during
 * graceful shutdown. Each new connection is added to the Set, and
 * removed when the socket closes.
 * 
 * @param {net.Socket} socket - The socket connection
 */
server.on('connection', (socket) => {
  // Add the socket to our tracking Set
  connections.add(socket);
  
  // Remove the socket when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful Shutdown Function
 * 
 * Initiates a graceful shutdown of the server:
 * 1. Stops accepting new connections
 * 2. Waits for existing connections to complete
 * 3. Force-closes remaining connections after timeout
 * 
 * @param {string} signal - The signal that triggered the shutdown
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

  // Force close connections after timeout to prevent hanging
  const forceCloseTimer = setTimeout(() => {
    console.log(`Force closing ${connections.size} remaining connections after ${SHUTDOWN_TIMEOUT / 1000}s timeout...`);
    connections.forEach((socket) => {
      socket.destroy();
    });
    process.exit(0);
  }, SHUTDOWN_TIMEOUT);

  // Don't keep the process alive just for this timer
  forceCloseTimer.unref();
};

// Signal Handlers for graceful shutdown

/**
 * SIGTERM Handler
 * 
 * Handles SIGTERM signal typically sent by orchestration systems
 * (Kubernetes, Docker, systemd) during deployment or scaling.
 */
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

/**
 * SIGINT Handler
 * 
 * Handles SIGINT signal sent when user presses Ctrl+C.
 */
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

/**
 * Uncaught Exception Handler
 * 
 * Catches any uncaught exceptions that bubble up to the process level.
 * Logs the error and initiates graceful shutdown to prevent data loss.
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  gracefulShutdown('uncaughtException');
});

/**
 * Unhandled Rejection Handler
 * 
 * Catches any unhandled promise rejections.
 * Logs the error and initiates graceful shutdown.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server - preserved startup message format from original
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Module exports for testing
// Exposes server instance, gracefulShutdown function, and connections Set
module.exports = { server, gracefulShutdown, connections };
