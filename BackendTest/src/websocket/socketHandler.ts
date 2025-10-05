import { Server as SocketIOServer, Socket } from 'socket.io';

interface ClientInfo {
  id: string;
  connectedAt: Date;
  userAgent?: string;
}

interface ClientManager {
  sendUpdateToClient: (clientId: string, event: string, data: any) => boolean;
  getConnectedClients: () => string[];
  isClientConnected: (clientId: string) => boolean;
}

export const setupWebSocket = (io: SocketIOServer): ClientManager => {
  const connectedClients = new Map<string, ClientInfo>();
  const clientSockets = new Map<string, Socket>();

  // Client Management Methods
  const clientManager: ClientManager = {
    // Send update to specific client
    sendUpdateToClient: (clientId: string, event: string, data: any): boolean => {
      const socket = clientSockets.get(clientId);
      if (socket && socket.connected) {
        socket.emit(event, data);
        console.log(`📤 Sent ${event} to client ${clientId}`);
        return true;
      }
      console.warn(`⚠️ Client ${clientId} not found or disconnected`);
      return false;
    },

    // Get list of connected client IDs
    getConnectedClients: (): string[] => {
      return Array.from(connectedClients.keys());
    },

    // Check if specific client is connected
    isClientConnected: (clientId: string): boolean => {
      const socket = clientSockets.get(clientId);
      return socket ? socket.connected : false;
    }
  };

  io.on('connection', (socket: Socket) => {
    const clientInfo: ClientInfo = {
      id: socket.id,
      connectedAt: new Date(),
      userAgent: socket.handshake.headers['user-agent']
    };

    connectedClients.set(socket.id, clientInfo);
    clientSockets.set(socket.id, socket);

    console.log(`🔌 Client connected: ${socket.id}`);
    console.log(`📊 Total connected clients: ${connectedClients.size}`);

    // Send welcome message to the specific client
    socket.emit('welcome', {
      message: 'Welcome to the WebSocket server! 🎉',
      clientId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Handle ping/pong for connection health
    socket.on('ping', (data: any) => {
      socket.emit('pong', {
        message: 'Pong! 🏓',
        timestamp: new Date().toISOString(),
        data: data
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      connectedClients.delete(socket.id);
      clientSockets.delete(socket.id);
      
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
      console.log(`📊 Total connected clients: ${connectedClients.size}`);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  console.log('🔌 WebSocket server initialized');
  return clientManager;
};
