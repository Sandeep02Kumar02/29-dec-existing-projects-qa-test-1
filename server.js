const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
const connections = new Set();

// Allowed HTTP methods whitelist for input validation
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum allowed URL length to prevent DoS via excessively long URIs
const MAX_URL_LENGTH = 2048;

const server = http.createServer((req, res) => {
  // Input validation - HTTP method whitelist check
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('405 Method Not Allowed\n');
    return;
  }

  // Input validation - URL format check (must be non-empty and start with '/')
  if (!req.url || !req.url.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('400 Bad Request\n');
    return;
  }

  // Input validation - URL length check (prevent DoS with extremely long URIs)
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('414 URI Too Long\n');
    return;
  }

  // Per-response timeout (30 seconds) to prevent slow responses from hanging
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('408 Request Timeout\n');
    }
    if (res.socket) {
      res.socket.destroy();
    }
  }, 30000);

  // Clear the timeout when response finishes normally
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  // Normal response - preserves original behavior exactly
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Server timeout configuration for resource protection
server.requestTimeout = 120000;   // 2 minutes for complete request
server.headersTimeout = 60000;    // 60 seconds for headers
server.keepAliveTimeout = 5000;   // 5 seconds idle cleanup

// Server-level error event handler to prevent unhandled exception crashes
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Port ${port} requires elevated privileges.`);
    process.exit(1);
  } else {
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

// Connection tracking - track active sockets for graceful shutdown cleanup
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

/**
 * Graceful shutdown function - stops accepting new connections,
 * waits for existing connections to complete, and force-closes
 * after a 10-second timeout to prevent hanging.
 * @param {string} signal - The signal or reason that triggered shutdown
 */
function gracefulShutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections and wait for existing ones to finish
  server.close(() => {
    console.log('Server closed. All connections handled.');
    process.exit(0);
  });

  // Force-close after 10 seconds if connections don't finish in time
  const forceCloseTimeout = setTimeout(() => {
    console.error('Forcing shutdown after timeout...');
    for (const socket of connections) {
      socket.destroy();
    }
    process.exit(1);
  }, 10000);

  // Ensure the timeout doesn't prevent the process from exiting naturally
  if (forceCloseTimeout.unref) {
    forceCloseTimeout.unref();
  }
}

// Signal handlers for clean process termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers to catch unexpected errors and shut down gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server on configured hostname and port
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Export server components for testing
module.exports = { server, gracefulShutdown, connections };
