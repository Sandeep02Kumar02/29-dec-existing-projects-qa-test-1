/**
 * Robust Production-Ready HTTP Server
 * 
 * This server implements enterprise-grade features including:
 * - Error event handling for startup failures (EADDRINUSE, EACCES)
 * - Graceful shutdown with signal handling (SIGTERM, SIGINT)
 * - Input validation (HTTP methods, URL format, URL length)
 * - Timeout configuration (request, headers, keep-alive)
 * - Connection tracking for clean shutdown
 */

const http = require('http');

// Server configuration constants (preserved from original)
const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Stores all active socket connections for cleanup during shutdown
const connections = new Set();

// Whitelist of allowed HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum allowed URL length to prevent DoS attacks
const MAX_URL_LENGTH = 2048;

// Timeout constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;    // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;     // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000;   // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;    // 30 seconds per-response timeout
const SHUTDOWN_TIMEOUT = 10000;    // 10 seconds force-close timeout

/**
 * HTTP Server with input validation and timeout handling
 */
const server = http.createServer((req, res) => {
  // ============================================
  // INPUT VALIDATION - HTTP Method
  // ============================================
  // Validate that the HTTP method is in our whitelist
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // ============================================
  // INPUT VALIDATION - URL Format
  // ============================================
  // Validate URL is non-empty and starts with '/'
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request: Invalid URL format\n');
    return;
  }

  // ============================================
  // INPUT VALIDATION - URL Length
  // ============================================
  // Validate URL doesn't exceed maximum length to prevent DoS attacks
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // ============================================
  // PER-RESPONSE TIMEOUT HANDLING
  // ============================================
  // Set a timeout for each response to prevent slow client attacks
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, RESPONSE_TIMEOUT);

  // Clear timeout when response finishes normally
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  res.on('close', () => {
    clearTimeout(responseTimeout);
  });

  // ============================================
  // NORMAL REQUEST HANDLING (preserved from original)
  // ============================================
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// ============================================
// SERVER TIMEOUT CONFIGURATION
// ============================================
// Configure server-level timeouts to prevent resource exhaustion

// Time allowed for the entire request (headers + body) - 2 minutes
server.requestTimeout = REQUEST_TIMEOUT;

// Time allowed to receive complete HTTP headers - 60 seconds
server.headersTimeout = HEADERS_TIMEOUT;

// Time to wait before closing idle keep-alive connections - 5 seconds
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;

// ============================================
// SERVER ERROR EVENT HANDLER
// ============================================
// Handle server startup errors to prevent unhandled exception crashes
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // Port is already in use by another process
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    // Insufficient permissions to bind to port
    console.error(`Error: Permission denied to bind to port ${port}. Try using a port number above 1024 or run with elevated privileges.`);
    process.exit(1);
  } else {
    // Generic server error handling
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

// ============================================
// CONNECTION TRACKING
// ============================================
// Track active connections for graceful shutdown cleanup
server.on('connection', (socket) => {
  // Add new connection to tracking set
  connections.add(socket);
  
  // Remove connection from tracking when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

// ============================================
// GRACEFUL SHUTDOWN FUNCTION
// ============================================
// Flag to prevent multiple shutdown calls
let isShuttingDown = false;

/**
 * Gracefully shuts down the server
 * 1. Stops accepting new connections
 * 2. Waits for existing connections to complete
 * 3. Force-closes remaining connections after timeout
 */
function gracefulShutdown() {
  // Prevent multiple shutdown calls
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

  // Set a timeout to force-close remaining connections
  const forceShutdownTimeout = setTimeout(() => {
    console.log(`Force closing ${connections.size} remaining connection(s) after timeout...`);
    
    // Destroy all remaining active connections
    connections.forEach((socket) => {
      socket.destroy();
    });
    
    console.log('Server closed. All connections handled.');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT);

  // Prevent the timeout from keeping the process alive if all connections close naturally
  forceShutdownTimeout.unref();
}

// ============================================
// SIGNAL HANDLERS
// ============================================
// Handle termination signals for graceful shutdown

// SIGTERM - Sent by orchestration systems (Kubernetes, Docker, etc.) during deployment
process.on('SIGTERM', () => {
  gracefulShutdown();
});

// SIGINT - Sent when user presses Ctrl+C
process.on('SIGINT', () => {
  console.log('\nSIGINT received. Starting graceful shutdown...');
  gracefulShutdown();
});

// Handle uncaught exceptions - unexpected errors that would crash the server
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  gracefulShutdown();
});

// Handle unhandled promise rejections - async errors without catch handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// ============================================
// SERVER STARTUP
// ============================================
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// ============================================
// MODULE EXPORTS
// ============================================
// Export server components for testing purposes
module.exports = { server, gracefulShutdown, connections };
