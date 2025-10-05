import { Server as SocketIOServer, Socket } from 'socket.io';

interface ClientInfo {
  id: string;
  connectedAt: Date;
  userAgent?: string;
}

export const setupWebSocket = (io: SocketIOServer): void => {
  const connectedClients = new Map<string, ClientInfo>();

  io.on('connection', (socket: Socket) => {
    const clientInfo: ClientInfo = {
      id: socket.id,
      connectedAt: new Date(),
      userAgent: socket.handshake.headers['user-agent']
    };

    connectedClients.set(socket.id, clientInfo);

    console.log(`🔌 Client connected: ${socket.id}`);
    console.log(`📊 Total connected clients: ${connectedClients.size}`);

    // Send welcome message
    socket.emit('welcome', {
      message: 'Welcome to the WebSocket server! 🎉',
      clientId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Broadcast to all clients that someone joined
    socket.broadcast.emit('user_joined', {
      clientId: socket.id,
      timestamp: new Date().toISOString(),
      totalClients: connectedClients.size
    });

    // Handle ping/pong for connection health
    socket.on('ping', (data: any) => {
      socket.emit('pong', {
        message: 'Pong! 🏓',
        timestamp: new Date().toISOString(),
        data: data
      });
    });

    // Handle chat messages
    socket.on('chat_message', (data: { message: string; username?: string }) => {
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

    // Handle custom events
    socket.on('custom_event', (data: any) => {
      console.log(`📨 Custom event from ${socket.id}:`, data);
      
      // Echo back to sender
      socket.emit('custom_event_response', {
        originalData: data,
        processedAt: new Date().toISOString(),
        clientId: socket.id
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      connectedClients.delete(socket.id);
      
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
      console.log(`📊 Total connected clients: ${connectedClients.size}`);

      // Broadcast to remaining clients
      socket.broadcast.emit('user_left', {
        clientId: socket.id,
        timestamp: new Date().toISOString(),
        totalClients: connectedClients.size
      });
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Optional: Send periodic updates to all clients
  setInterval(() => {
    io.emit('server_status', {
      timestamp: new Date().toISOString(),
      connectedClients: connectedClients.size,
      uptime: process.uptime()
    });
  }, 30000); // Every 30 seconds

  console.log('🔌 WebSocket server initialized');
};
