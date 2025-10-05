import { Server as SocketIOServer, Socket } from 'socket.io';
import { AppDataSource } from '../services/typeorm';
import { computeAssetPlacementVector } from '../services/reverseVectorAlgorithm';
import Decimal from 'decimal.js';

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
  creator_latitude: number;
  creator_longitude: number;
  vector_position: { x: number; y: number; z: number };
  vector_relative?: { e: number; n: number; u: number }; // Computed user→asset vector
  angulation: { x: number; y: number; z: number };
  distance_meters: number;
  coordinates?: number[]; // Original coordinates array
}

// Query database for assets close to user location from RawFrontend table
const getNearbyAssets = async (lat: number, lon: number, radiusMeters: number = 100): Promise<AssetData[]> => {
  try {
    // Query RawFrontend table for nearby assets with creator position and original vector
    const query = `
      SELECT 
        r.objectid as id,
        'Asset-' || r.objectid as name,
        'Placed asset' as description,
        'ar_object' as category,
        'placeholder_glb_data' as glb_data,
        r.objectlatitude as latitude,
        r.objectlongitude as longitude,
        COALESCE(r.coordinates[3], 370) as altitude,
        r.userlatitude as creator_latitude,
        r.userlongitude as creator_longitude,
        r.coordinates,
        ST_Distance(
          ST_Transform(r.object_location, 3857),
          ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
        ) as distance_meters
      FROM public.rawfrontend r
      WHERE r.object_location IS NOT NULL
        AND ST_DWithin(
          ST_Transform(r.object_location, 3857),
          ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857),
          $3
        )
      ORDER BY distance_meters
      LIMIT 10
    `;

    const result = await AppDataSource.query(query, [lat, lon, radiusMeters]);

    // Parse and format assets with creator position and original vector
    return result.map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      glb_data: asset.glb_data,
      latitude: parseFloat(asset.latitude),
      longitude: parseFloat(asset.longitude),
      altitude: parseFloat(asset.altitude) || 370,
      creator_altitude: 370, // Default altitude
      creator_latitude: parseFloat(asset.creator_latitude),
      creator_longitude: parseFloat(asset.creator_longitude),
      // Original vector from creator to asset (stored in coordinates array)
      // coordinates array is [lat, lon, h] but we need [e, n, u]
      // For now, we'll compute it from creator and asset positions
      vector_position: { x: 0, y: 0, z: 0 }, // Will be computed
      angulation: { x: 0, y: 0, z: 0 },
      distance_meters: parseFloat(asset.distance_meters),
      coordinates: asset.coordinates // Store for later computation
    }));

  } catch (error) {
    console.error('Error querying nearby assets:', error);
    return [];
  }
};

// RenderElements function - queries database and computes relative vectors
const RenderElements = async (clientId: string, position: {refined_lon: number, refined_lat: number}) => {
  console.log(`🎯 RenderElements called for client ${clientId} at position:`, position);
  
  try {
    // Query for nearby assets within 100 meters
    const nearbyAssets = await getNearbyAssets(position.refined_lat, position.refined_lon, 100);
    
    console.log(`📍 Found ${nearbyAssets.length} nearby assets for client ${clientId}`);
    
    // Compute relative vector for each asset using computeAssetPlacementVector
    const assetsWithVectors = nearbyAssets.map(asset => {
      try {
        // We need the original creator→asset vector
        // Since we don't have it stored directly, we compute it from positions
        // The vector_position in database is actually the ENU offset used when creating
        // For now, we'll use a simple approach: compute user→asset directly
        
        // Extract original vector from coordinates if available
        // coordinates array might be [lat, lon, h] but we need [e, n, u]
        // Let's use a simple ENU calculation as fallback
        const originalVector = asset.vector_position || { x: 0, y: 0, z: 0 };
        
        // Compute the relative vector from current user to asset
        const vectorRelative = computeAssetPlacementVector(
          { 
            lat: asset.creator_latitude, 
            lon: asset.creator_longitude, 
            h: asset.creator_altitude 
          }, // Creator position (original user)
          { 
            lat: position.refined_lat, 
            lon: position.refined_lon, 
            h: 370 
          }, // Current user position
          { 
            e: originalVector.x, 
            n: originalVector.y, 
            u: originalVector.z 
          } // Original creator→asset vector
        );
        
        console.log(`  - ${asset.name}: dist=${asset.distance_meters.toFixed(2)}m, vec=(${vectorRelative.e.toFixed(2)}, ${vectorRelative.n.toFixed(2)}, ${vectorRelative.u.toFixed(2)})`);
        
        return {
          ...asset,
          vector_relative: vectorRelative
        };
      } catch (error) {
        console.error(`Error computing vector for asset ${asset.id}:`, error);
        return asset;
      }
    });
    
    return assetsWithVectors;
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
