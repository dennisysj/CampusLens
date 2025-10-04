import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const port = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '🚀 Simple Express.js TypeScript Server with Supabase!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      hello: '/hello',
      users: '/users',
      products: '/products'
    },
    websocket: 'Available at /socket.io/'
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Server is healthy! 🟢',
    timestamp: new Date().toISOString()
  });
});

app.get('/hello', (req: Request, res: Response) => {
  res.json({
    message: 'Hello World! 👋',
    timestamp: new Date().toISOString()
  });
});

// Users endpoint with PostgreSQL



// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Send welcome message
  socket.emit('welcome', {
    message: 'Welcome to the WebSocket server! 🎉',
    clientId: socket.id,
    timestamp: new Date().toISOString()
  });

  // Handle ping/pong
  socket.on('ping', (data) => {
    socket.emit('pong', {
      message: 'Pong! 🏓',
      timestamp: new Date().toISOString(),
      data: data
    });
  });

  // Handle chat messages
  socket.on('chat_message', (data) => {
    const message = {
      id: socket.id,
      username: data.username || 'Anonymous',
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all clients
    io.emit('chat_message', message);
    console.log(`💬 Chat message from ${socket.id}: ${data.message}`);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});





// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health: http://localhost:${port}/health`);
  console.log(`👋 Hello: http://localhost:${port}/hello`);
  console.log(`👥 Users: http://localhost:${port}/users`);
  console.log(`🛍️ Products: http://localhost:${port}/products`);
  console.log(`🔌 WebSocket: ws://localhost:${port}/socket.io/`);
  console.log(`🌍 Network: http://[YOUR_IP]:${port}`);
});