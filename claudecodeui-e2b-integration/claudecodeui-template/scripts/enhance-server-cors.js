#!/usr/bin/env node
/**
 * Enhanced CORS configuration patch for claudecodeui server
 * This script patches the server.js file to add comprehensive CORS and iframe support
 */

const fs = require('fs');
const path = require('path');

// Try different possible server file locations
const possibleServerPaths = [
  '/home/user/claudecodeui/server.js',
  '/home/user/claudecodeui/server/index.js',
  '/home/user/claudecodeui/server/server.js'
];

let SERVER_PATH = null;
for (const path of possibleServerPaths) {
  if (fs.existsSync(path)) {
    SERVER_PATH = path;
    break;
  }
}

if (!SERVER_PATH) {
  // Create a basic server.js if none exists
  SERVER_PATH = '/home/user/claudecodeui/server.js';
  console.log('Creating basic server.js file...');
  
  const basicServer = `const express = require('express');
const app = express();
const port = process.env.PORT || 3008;

// Basic server setup
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'claudecodeui server is running' });
});

const server = app.listen(port, () => {
  console.log('Server running on port ' + port);
});

module.exports = { app, server };
`;
  
  fs.writeFileSync(SERVER_PATH, basicServer);
}

// Enhanced CORS middleware code
const corsMiddleware = `
// Enhanced CORS middleware for iframe support
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow specific origins including PRIA Admin deployments
  const allowedOrigins = [
    'http://localhost:3000',           // Local PRIA Admin
    'http://localhost:3001', 
    'http://localhost:3002',
    /^https?:\\/\\/.*\\.e2b\\.app$/,       // E2B sandbox domains
    /^https?:\\/\\/.*\\.localhost$/,      // Local development
    /^https?:\\/\\/.*\\.vercel\\.app$/,    // PRIA Admin deployments
    /^https?:\\/\\/.*\\.netlify\\.app$/    // Alternative deployments
  ];
  
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    }
    return allowedOrigin.test(origin);
  });
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Content Security Policy for iframe embedding
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws: wss: *",
    "frame-ancestors *",              // Allow embedding in any iframe
    "img-src 'self' data: blob:",
    "font-src 'self' data:"
  ].join('; '));
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});`;

// Enhanced Socket.IO configuration
const socketIOConfig = `
// Enhanced Socket.IO setup for iframe websockets
const io = require('socket.io')(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      /^https?:\\/\\/.*\\.e2b\\.app$/,
      /^https?:\\/\\/.*\\.localhost$/,
      /^https?:\\/\\/.*\\.vercel\\.app$/
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'], // Fallback for iframe restrictions
  pingTimeout: 60000,
  pingInterval: 25000
});

// Handle iframe-specific connection events
io.on('connection', (socket) => {
  console.log('Client connected from:', socket.handshake.headers.origin);
  
  socket.on('iframe-ready', (data) => {
    console.log('Iframe client ready:', data);
    socket.emit('server-ready', { timestamp: Date.now() });
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', reason);
  });
});`;

async function patchServerFile() {
  try {
    if (!fs.existsSync(SERVER_PATH)) {
      console.error('Server file not found:', SERVER_PATH);
      process.exit(1);
    }
    
    let serverContent = fs.readFileSync(SERVER_PATH, 'utf8');
    
    // Check if already patched
    if (serverContent.includes('Enhanced CORS middleware for iframe support')) {
      console.log('Server already patched with enhanced CORS configuration');
      return;
    }
    
    // Find where to insert CORS middleware (after express app creation)
    const appCreationRegex = /(const app = express\(\);?|app = express\(\);?)/;
    const appMatch = serverContent.match(appCreationRegex);
    
    if (!appMatch) {
      console.error('Could not find Express app creation in server.js');
      process.exit(1);
    }
    
    // Insert CORS middleware after app creation
    const insertIndex = appMatch.index + appMatch[0].length;
    const beforeInsert = serverContent.substring(0, insertIndex);
    const afterInsert = serverContent.substring(insertIndex);
    
    serverContent = beforeInsert + '\n' + corsMiddleware + '\n' + afterInsert;
    
    // Find Socket.IO initialization and replace/enhance it
    const socketIORegex = /(const io = require\('socket\.io'\)\([^}]+}\);?)/s;
    const socketMatch = serverContent.match(socketIORegex);
    
    if (socketMatch) {
      serverContent = serverContent.replace(socketIORegex, socketIOConfig);
    } else {
      // If no existing Socket.IO config found, add it after server creation
      const serverRegex = /(const server = .*|server = .*)/;
      const serverMatch = serverContent.match(serverRegex);
      
      if (serverMatch) {
        const serverInsertIndex = serverMatch.index + serverMatch[0].length;
        const beforeServerInsert = serverContent.substring(0, serverInsertIndex);
        const afterServerInsert = serverContent.substring(serverInsertIndex);
        
        serverContent = beforeServerInsert + '\n' + socketIOConfig + '\n' + afterServerInsert;
      }
    }
    
    // Write the patched file
    fs.writeFileSync(SERVER_PATH, serverContent);
    console.log('✓ Server patched with enhanced CORS and iframe support');
    
  } catch (error) {
    console.error('Error patching server file:', error);
    process.exit(1);
  }
}

// Run the patch
patchServerFile();