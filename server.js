const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown - stores active socket references
const connections = new Set();

// Allowed HTTP methods whitelist for input validation
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const server = http.createServer((req, res) => {
  // Input validation - HTTP method must be in the allowed whitelist
  // Returns 405 Method Not Allowed for unrecognized or disallowed methods
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method Not Allowed\n');
    return;
  }

  // Input validation - URL must be non-empty and start with '/'
  // Returns 400 Bad Request for malformed URL formats
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request\n');
    return;
  }

  // Input validation - URL length must not exceed 2048 characters
  // Returns 414 URI Too Long to prevent DoS attacks via excessively long URIs
  if (req.url.length > 2048) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout of 30 seconds - returns 408 Request Timeout
  // Prevents slow clients from consuming server resources indefinitely
  const responseTimeout = setTimeout(() => {
    if (!res.writableEnded) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, 30000);

  // Clear the per-response timeout when the response completes normally
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  // Preserved original response: 200 OK with "Hello, World!"
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Timeout configuration for server-level timeouts
server.requestTimeout = 120000;   // 2 minutes for the complete request to arrive
server.headersTimeout = 60000;    // 60 seconds for request headers to arrive
server.keepAliveTimeout = 5000;   // 5 seconds idle timeout for keep-alive connections

// Server error event handler - prevents unhandled exception crashes on startup failures
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the existing process.`);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try using a port above 1024 or run with elevated privileges.`);
  } else {
    console.error(`Error: Server encountered an unexpected error: ${error.message}`);
  }
  process.exit(1);
});

// Connection tracking - monitor active sockets to enable graceful shutdown cleanup
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

// Flag to prevent multiple concurrent shutdown attempts
let isShuttingDown = false;

// Graceful shutdown function - stops accepting new connections and cleans up resources
function gracefulShutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log('Starting graceful shutdown...');

  // Stop accepting new connections and wait for existing ones to complete
  server.close(() => {
    console.log('Server closed. All connections handled.');
    clearTimeout(forceCloseTimeout);
    process.exit(0);
  });

  // Force-close all remaining connections after a 10-second timeout
  const forceCloseTimeout = setTimeout(() => {
    console.log('Force-closing remaining connections after timeout...');
    for (const socket of connections) {
      socket.destroy();
    }
    process.exit(1);
  }, 10000);

  // Prevent the force-close timeout from keeping the event loop alive
  forceCloseTimeout.unref();
}

// Signal handler - SIGTERM for orchestration/deployment shutdowns
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  gracefulShutdown();
});

// Signal handler - SIGINT for user interruption (Ctrl+C)
process.on('SIGINT', () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  gracefulShutdown();
});

// Handler for uncaught exceptions - logs error details and exits cleanly
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

// Handler for unhandled promise rejections - logs rejection reason and exits cleanly
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the server on the configured hostname and port
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Export server and gracefulShutdown for testing
module.exports = { server, gracefulShutdown };
