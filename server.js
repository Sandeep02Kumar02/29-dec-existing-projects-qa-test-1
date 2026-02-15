const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown - stores active socket references
const connections = new Set();

// Allowed HTTP methods whitelist for input validation
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks via excessively long URIs
const MAX_URL_LENGTH = 2048;

const server = http.createServer((req, res) => {
  // Input validation - HTTP method whitelist check
  // Rejects requests with invalid or unsupported HTTP methods
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.end('Method Not Allowed\n');
    return;
  }

  // Input validation - URL format check
  // URL must be non-empty and start with '/' per HTTP specification
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request\n');
    return;
  }

  // Input validation - URL length check
  // Prevents resource exhaustion from excessively long URIs (max 2048 characters)
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Set per-response timeout of 30 seconds to prevent hanging responses
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, 30000);

  // Clear the response timeout when the response finishes normally
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  // Normal response - preserves original server behavior
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Server timeout configuration - prevents resource exhaustion from slow clients
server.requestTimeout = 120000;   // 2 minutes for complete request body
server.headersTimeout = 60000;    // 60 seconds for request headers
server.keepAliveTimeout = 5000;   // 5 seconds idle before closing keep-alive connections

// Error event handler for server-level errors during startup and operation
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try using a port above 1024 or run with elevated privileges.`);
    process.exit(1);
  } else {
    console.error(`Error: An unexpected server error occurred: ${error.message}`);
    process.exit(1);
  }
});

// Connection tracking - monitors active sockets for graceful shutdown cleanup
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful shutdown function - ensures clean server termination.
 * Stops accepting new connections, waits for existing connections to complete,
 * and force-closes all remaining connections after a 10-second timeout.
 * @param {string} signal - The signal that triggered shutdown (e.g., 'SIGTERM', 'SIGINT')
 */
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections and wait for existing ones to finish
  server.close(() => {
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Force-close timeout - destroys remaining connections after 10 seconds
  const forceCloseTimeout = setTimeout(() => {
    console.error('Forcefully shutting down after timeout. Destroying remaining connections...');
    connections.forEach((socket) => {
      socket.destroy();
    });
    process.exit(1);
  }, 10000);

  // Unref the timeout so it does not prevent the process from exiting naturally
  forceCloseTimeout.unref();
}

// Signal handlers for graceful termination during deployment or user interruption
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handler for uncaught exceptions - logs the error and exits cleanly
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Handler for unhandled promise rejections - logs the reason and exits cleanly
process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Start the server on the configured hostname and port
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Export server components for testing and external use
module.exports = { server, gracefulShutdown, connections };
