/**
 * Robust HTTP Server Implementation
 * 
 * This server includes comprehensive error handling, graceful shutdown,
 * input validation, timeout configuration, and connection tracking.
 */

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
// Stores all active socket connections to enable proper cleanup during shutdown
const connections = new Set();

// Allowed HTTP methods whitelist for input validation
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks
const MAX_URL_LENGTH = 2048;

// Timeout configuration constants (in milliseconds)
const REQUEST_TIMEOUT = 120000;    // 2 minutes for complete request
const HEADERS_TIMEOUT = 60000;     // 60 seconds for headers
const KEEP_ALIVE_TIMEOUT = 5000;   // 5 seconds idle cleanup
const RESPONSE_TIMEOUT = 30000;    // 30 seconds per-response timeout
const SHUTDOWN_TIMEOUT = 10000;    // 10 seconds force-close during shutdown

/**
 * HTTP Server Request Handler
 * Validates incoming requests and sends appropriate responses
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request
 * @param {http.ServerResponse} res - The HTTP response object
 */
const server = http.createServer((req, res) => {
  // Input Validation - HTTP Method Whitelist
  // Validates that the request method is in the allowed list
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
  // Validates that the URL doesn't exceed the maximum allowed length
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout configuration
  // Returns 408 Request Timeout if response takes too long
  const responseTimer = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
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

  // Successful response - preserve original behavior
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Server Timeout Configuration
// These settings prevent slow clients from consuming resources indefinitely
server.requestTimeout = REQUEST_TIMEOUT;     // 2 minutes for complete request
server.headersTimeout = HEADERS_TIMEOUT;     // 60 seconds for headers
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT; // 5 seconds idle cleanup

/**
 * Server Error Event Handler
 * Handles server-level errors such as port conflicts and permission issues
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
 * Each new connection is added to the Set, and removed when closed
 */
server.on('connection', (socket) => {
  // Add the socket to the connections Set
  connections.add(socket);
  
  // Remove the socket from the Set when it closes
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful Shutdown Function
 * Stops accepting new connections and waits for existing connections to complete
 * Force-closes remaining connections after timeout to ensure process can exit
 */
function gracefulShutdown() {
  console.log('Received shutdown signal. Starting graceful shutdown...');
  
  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Set a timeout to force-close remaining connections
  const forceCloseTimer = setTimeout(() => {
    console.log('Forcing shutdown due to timeout. Destroying remaining connections...');
    
    // Destroy all remaining connections
    connections.forEach((socket) => {
      socket.destroy();
    });
    
    console.log(`Forced shutdown complete. ${connections.size} connections were terminated.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Prevent the timer from keeping the process alive
  forceCloseTimer.unref();
}

/**
 * Signal Handlers
 * Capture termination signals for proper cleanup
 */

// SIGTERM handler - typically sent by orchestration/deployment systems
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
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

// Unhandled Rejection handler - catches unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown();
});

/**
 * Start the server
 * Listen on the configured hostname and port
 */
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Module exports for testing
module.exports = { server, gracefulShutdown, connections };
