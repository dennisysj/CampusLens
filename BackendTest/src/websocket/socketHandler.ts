import { Server as SocketIOServer, Socket } from 'socket.io';
import { AppDataSource } from '../services/typeorm';
import Decimal from 'decimal.js';
import http from 'http';
import express from 'express';
const app = express();

const server = http.createServer(app);
const io = new SocketIOServer(server);

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
//ws://localhost:3000/socket.io/?EIO=4&transport=websocket
// WORKS to download, fails if i send from postman

interface ClientInfo {
  id: string;
  connectedAt: Date;
  userAgent?: string;
  currentPosition?: {
    refined_lon: number;
    refined_lat: number;
  };
  initialPosition?: {
    refined_lon: number;
    refined_lat: number;
  };
  state: 'accept' | 'ok' | 'off_boundaries';
}

interface ClientManager {
  sendUpdateToClient: (clientId: string, event: string, data: any) => boolean;
  getConnectedClients: () => string[];
  isClientConnected: (clientId: string) => boolean;
}

// Triangulate coordinate function using database
const triangulateCoordinate = async (lat: number, lon: number): Promise<{refined_lon: number, refined_lat: number}> => {
  try {
    const result = await AppDataSource.query(
      'SELECT * FROM triangulate_coordinate($1, $2)',
      [lat, lon]
    );
    
    if (result && result.length > 0) {
      return {
        refined_lon: result[0].refined_lon,
        refined_lat: result[0].refined_lat
      };
    }
    
    // Fallback to original coordinates if no result
    return {
      refined_lon: lon,
      refined_lat: lat
    };
  } catch (error) {
    console.error('Error in triangulateCoordinate:', error);
    return {
      refined_lon: lon,
      refined_lat: lat
    };
  }
};

// Calculate distance between two points in meters using precise decimal arithmetic
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = new Decimal(6371e3); // Earth's radius in meters
  
  // Convert to Decimal for precise calculations
  const lat1Decimal = new Decimal(lat1);
  const lon1Decimal = new Decimal(lon1);
  const lat2Decimal = new Decimal(lat2);
  const lon2Decimal = new Decimal(lon2);
  
  // Convert degrees to radians with precise arithmetic
  const φ1 = lat1Decimal.times(Math.PI).dividedBy(180).toNumber();
  const φ2 = lat2Decimal.times(Math.PI).dividedBy(180).toNumber();
  const Δφ = lat2Decimal.minus(lat1Decimal).times(Math.PI).dividedBy(180).toNumber();
  const Δλ = lon2Decimal.minus(lon1Decimal).times(Math.PI).dividedBy(180).toNumber();

  // Haversine formula with precise decimal arithmetic for final calculation
  const sinHalfDeltaPhi = Math.sin(Δφ / 2);
  const sinHalfDeltaLambda = Math.sin(Δλ / 2);
  
  const a = new Decimal(sinHalfDeltaPhi).pow(2)
    .plus(new Decimal(Math.cos(φ1)).times(Math.cos(φ2)).times(new Decimal(sinHalfDeltaLambda).pow(2)));
  
  const c = new Decimal(2).times(Math.atan2(a.sqrt().toNumber(), new Decimal(1).minus(a).sqrt().toNumber()));

  return R.times(c).toNumber(); // Distance in meters
};

// Interface for asset data
interface AssetData {
  id: number;
  name: string;
  description?: string;
  category: string;
  glb_data: string;
  latitude: number;
  longitude: number;
  altitude: number;
  creator_altitude: number;
  vector_position: { x: number; y: number; z: number };
  angulation: { x: number; y: number; z: number };
  distance_meters: number;
}

// Query database for assets close to user location
const getNearbyAssets = async (lat: number, lon: number, radiusMeters: number = 100): Promise<AssetData[]> => {
  try {
    // TODO: Replace this with your custom database query
    // This is a placeholder implementation using the existing locations table
    const query = `
      SELECT 
        l.id,
        l.name,
        l.description,
        l.category,
        'placeholder_glb_data' as glb_data,
        ST_Y(l.coordinates) as latitude,
        ST_X(l.coordinates) as longitude,
        l.floor_level as altitude,
        l.floor_level as creator_altitude,
        '{"x": 0, "y": 0, "z": 0}' as vector_position,
        '{"x": 0, "y": 0, "z": 0}' as angulation,
        ST_Distance(
          ST_Transform(l.coordinates, 3857),
          ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
        ) as distance_meters
      FROM locations l
      WHERE ST_DWithin(
        ST_Transform(l.coordinates, 3857),
        ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857),
        $3
      )
      ORDER BY distance_meters
      LIMIT 10
    `;

    const result = await AppDataSource.query(query, [lat, lon, radiusMeters]);

    // Parse JSON fields and return formatted assets
    return result.map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      glb_data: asset.glb_data,
      latitude: parseFloat(asset.latitude),
      longitude: parseFloat(asset.longitude),
      altitude: parseFloat(asset.altitude) || 0,
      creator_altitude: parseFloat(asset.creator_altitude) || 0,
      vector_position: typeof asset.vector_position === 'string' 
        ? JSON.parse(asset.vector_position) 
        : asset.vector_position || { x: 0, y: 0, z: 0 },
      angulation: typeof asset.angulation === 'string' 
        ? JSON.parse(asset.angulation) 
        : asset.angulation || { x: 0, y: 0, z: 0 },
      distance_meters: parseFloat(asset.distance_meters)
    }));

  } catch (error) {
    console.error('Error querying nearby assets:', error);
    return [];
  }
};

// RenderElements function - now queries database for nearby assets
const RenderElements = async (clientId: string, position: {refined_lon: number, refined_lat: number}) => {
  console.log(`🎯 RenderElements called for client ${clientId} at position:`, position);
  
  try {
    // Query for nearby assets within 100 meters
    const nearbyAssets = await getNearbyAssets(position.refined_lat, position.refined_lon, 100);
    
    console.log(`📍 Found ${nearbyAssets.length} nearby assets for client ${clientId}`);
    
    // Log asset details for debugging
    nearbyAssets.forEach(asset => {
      console.log(`  - ${asset.name} (${asset.category}) - ${asset.distance_meters.toFixed(2)}m away`);
    });
    
    return nearbyAssets;
  } catch (error) {
    console.error(`❌ Error in RenderElements for client ${clientId}:`, error);
    return [];
  }
};

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
      userAgent: socket.handshake.headers['user-agent'],
      state: 'accept' // Initial state
    };

    connectedClients.set(socket.id, clientInfo);
    clientSockets.set(socket.id, socket);

    console.log(`🔌 Client connected: ${socket.id}`);
    console.log(`📊 Total connected clients: ${connectedClients.size}`);

    // Send welcome message to the specific client
    socket.emit('welcome', {
      message: 'Welcome to the WebSocket server! 🎉',
      clientId: socket.id,
      timestamp: new Date().toISOString(),
      state: 'accept'
    });

    // Handle user position updates
    socket.on('user_position', async (data: {lat: number, lon: number}) => {
      try {
        const client = connectedClients.get(socket.id);
        if (!client) return;

        // Triangulate the coordinate
        const refinedPosition = await triangulateCoordinate(data.lat, data.lon);
        
        // Update current position
        client.currentPosition = refinedPosition;

        // If this is the first position (no initial position set), set it and stay in 'accept' state
        if (!client.initialPosition) {
          client.initialPosition = refinedPosition;
          client.state = 'accept';
          
          console.log(`📍 Initial position set for ${socket.id}:`, refinedPosition);
          socket.emit('position_status', {
            state: 'accept',
            message: 'Initial position recorded',
            position: refinedPosition
          });
          return;
        }

        // Calculate distance from initial position
        const distance = calculateDistance(
          client.initialPosition.refined_lat,
          client.initialPosition.refined_lon,
          refinedPosition.refined_lat,
          refinedPosition.refined_lon
        );

        console.log(`📍 Position update for ${socket.id}:`, {
          current: refinedPosition,
          initial: client.initialPosition,
          distance: distance.toFixed(2) + 'm',
          state: client.state
        });

        // Check if user has moved beyond 50 meters using precise comparison
        const boundaryDistance = new Decimal(50);
        const currentDistance = new Decimal(distance);
        
        if (currentDistance.greaterThan(boundaryDistance)) {
          if (client.state === 'accept' || client.state === 'ok') {
            // User moved beyond boundaries
            client.state = 'off_boundaries';
            
            // Call RenderElements function to get nearby assets
            const nearbyAssets = await RenderElements(socket.id, refinedPosition);
 
            // Send off_boundaries response with actual asset data
            socket.emit('off_boundaries', {
              status: false,
              assets: nearbyAssets.length > 0 ? nearbyAssets : [{
                id: 0,
                name: 'No nearby assets',
                description: 'No assets found in the area',
                category: 'none',
                glb_data: 'placeholder_glb_data',
                latitude: refinedPosition.refined_lat,
                longitude: refinedPosition.refined_lon,
                altitude: 0,
                creator_altitude: 0,
                vector_position: { x: 0, y: 0, z: 0 },
                angulation: { x: 0, y: 0, z: 0 },
                distance_meters: 0
              }]
            });
            
            console.log(`🚨 Client ${socket.id} moved beyond boundaries (${distance.toFixed(2)}m)`);
          }
        } else {
          // User is within boundaries
          if (client.state === 'off_boundaries') {
            // User came back within boundaries
            client.state = 'ok';
            socket.emit('position_status', {
              state: 'ok',
              message: 'Back within boundaries',
              position: refinedPosition
            });
            console.log(`✅ Client ${socket.id} back within boundaries`);
          } else if (client.state === 'accept') {
            // Still in initial accept state, just update position
            socket.emit('position_status', {
              state: 'ok',
              message: 'Position updated',
              position: refinedPosition
            });
            client.state = 'ok';
          }
        }
      } catch (error) {
        console.error(`❌ Error handling position for ${socket.id}:`, error);
        socket.emit('error', {
          message: 'Error processing position',
          error: error
        });
      }
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
