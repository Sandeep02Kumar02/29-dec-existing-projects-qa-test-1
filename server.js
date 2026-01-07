const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Connection tracking for graceful shutdown
const connections = new Set();

// Allowed HTTP methods whitelist
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Maximum URL length to prevent DoS attacks
const MAX_URL_LENGTH = 2048;

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

  // Input validation - URL length limit
  if (req.url.length > MAX_URL_LENGTH) {
    res.statusCode = 414;
    res.setHeader('Content-Type', 'text/plain');
    res.end('URI Too Long\n');
    return;
  }

  // Per-response timeout (30 seconds)
  const responseTimeout = setTimeout(() => {
    if (!res.writableEnded) {
      res.statusCode = 408;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Request Timeout\n');
    }
  }, 30000);

  // Clear the timeout when response is finished
  res.on('finish', () => {
    clearTimeout(responseTimeout);
  });

  // Normal response - preserved from original implementation
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Timeout configuration
// Time to receive the entire request from the client (2 minutes)
server.requestTimeout = 120000;

// Time to receive the complete HTTP headers (60 seconds)
server.headersTimeout = 60000;

// Time to keep idle connections open (5 seconds)
server.keepAliveTimeout = 5000;

// Error event handler for server-level errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Error: Permission denied. Cannot bind to port ${port}. Try using a port above 1024 or run with elevated privileges.`);
    process.exit(1);
  } else {
    console.error(`Server error: ${error.message}`);
    process.exit(1);
  }
});

// Connection tracking - track active sockets for graceful shutdown
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

// Graceful shutdown function
// Stops accepting new connections, waits for existing ones to complete,
// and force-closes remaining connections after timeout
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

  // Force-close connections after 10-second timeout
  const forceCloseTimeout = setTimeout(() => {
    console.log(`Force-closing ${connections.size} remaining connections after timeout...`);
    connections.forEach((socket) => {
      socket.destroy();
    });
    process.exit(0);
  }, 10000);

  // Ensure the timeout doesn't prevent the process from exiting naturally
  forceCloseTimeout.unref();
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Handler for unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  gracefulShutdown('uncaughtException');
});

// Handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Export for testing
module.exports = { server, gracefulShutdown, connections };
