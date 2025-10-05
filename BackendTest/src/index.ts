import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { geodeticToEcef, enuOffsetToGeodetic } from './services/geo-converter';
import { AppDataSource, initializeDatabase } from './services/typeorm';
import { RawFrontend } from './entities/RawFrontend';

// Load environment variables
dotenv.config();

// Initialize database connection
const initDB = async () => {
  const connected = await initializeDatabase();
  if (!connected) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }
};
initDB();

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



// Refine user coordinates then calculate object's Earth coordinates from refined position + vector
async function processAssetData(
  userLatitude: number,
  userLongitude: number,
  position: [number, number, number]
) {
  try {
    const rawFrontendRepo = AppDataSource.getRepository(RawFrontend);

    // Validate required fields
    if (!userLatitude || !userLongitude || !position) {
      throw new Error('Missing required fields: userLatitude, userLongitude, position');
    }

    // Step 1: Refine user coordinates using triangulate_coordinate SQL function
    const refinedUser = await triangulateCoordinates(userLongitude, userLatitude);
    
    console.log(`📍 User coords refined: (${userLatitude}, ${userLongitude}) → (${refinedUser.refinedLat}, ${refinedUser.refinedLon})`);

    // Step 2: Calculate object's Earth coordinates using refined user position + original vector
    const objectCoords = enuOffsetToGeodetic(
      refinedUser.refinedLat,   // Refined user latitude (origin)
      refinedUser.refinedLon,   // Refined user longitude (origin)
      position[0],              // East offset (x) - original vector
      position[1],              // North offset (y) - original vector
      position[2]               // Up offset (z) - original vector
    );

    // Step 3: Store refined user coordinates and calculated object coordinates
    const recordData: any = {
      objectLongitude: objectCoords.lon,
      objectLatitude: objectCoords.lat,
      userLongitude: refinedUser.refinedLon,
      userLatitude: refinedUser.refinedLat,
      coordinates: [objectCoords.lat, objectCoords.lon, objectCoords.h]
    };

    const newRecord = rawFrontendRepo.create(recordData);
    const savedRecord = await rawFrontendRepo.save(newRecord) as unknown as RawFrontend;

    // Step 4: Update geometry columns with PostGIS POINT data
    await AppDataSource.query(
      `UPDATE public.rawfrontend 
       SET object_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
           user_location = ST_SetSRID(ST_MakePoint($3, $4), 4326)
       WHERE objectid = $5`,
      [
        objectCoords.lon,
        objectCoords.lat,
        refinedUser.refinedLon,
        refinedUser.refinedLat,
        savedRecord.objectid
      ]
    );

    console.log('✅ Object position calculated and saved:', savedRecord.objectid);
    console.log(`📍 Refined User: (${refinedUser.refinedLat}, ${refinedUser.refinedLon}) + Vector: [${position.join(', ')}] → Object: (${objectCoords.lat}, ${objectCoords.lon})`);

    return {
      id: savedRecord.objectid,
      objectCoordinates: { lat: objectCoords.lat, lon: objectCoords.lon, h: objectCoords.h },
      userCoordinates: { 
        original: { lat: userLatitude, lon: userLongitude },
        refined: { lat: refinedUser.refinedLat, lon: refinedUser.refinedLon }
      },
      vector: position,
      record: savedRecord
    };

  } catch (error) {
    console.error('Error processing asset data:', error);
    throw error;
  }
}

// Helper function to refine coordinates using SQL triangulate_coordinate function
async function triangulateCoordinates(lon: number, lat: number) {
  try {
    const result = await AppDataSource.query(
      'SELECT * FROM campuslens.triangulate_coordinate($1, $2)',
      [lon, lat]
    );

    if (result && result.length > 0) {
      const triangulation = result[0];
      return {
        originalLon: triangulation.original_lon,
        originalLat: triangulation.original_lat,
        refinedLon: triangulation.refined_lon,
        refinedLat: triangulation.refined_lat,
        refinementMeters: triangulation.refinement_meters,
        confidenceScore: triangulation.confidence_score
      };
    } else {
      // If triangulation fails, return original coordinates
      console.warn('Triangulation returned no results, using original coordinates');
      return {
        originalLon: lon,
        originalLat: lat,
        refinedLon: lon,
        refinedLat: lat,
        refinementMeters: 0,
        confidenceScore: 0
      };
    }
  } catch (error) {
    console.error('Error calling triangulate_coordinate function:', error);
    // Return original coordinates if triangulation fails
    return {
      originalLon: lon,
      originalLat: lat,
      refinedLon: lon,
      refinedLat: lat,
      refinementMeters: 0,
      confidenceScore: 0
    };
  }
}


app.post('/receive_data_about_assets', async (req: Request, res: Response) => {
  try {
    console.log('Received data:', req.body);

    // Extract only the required data: user coordinates + position vector
    const userLatitude = req.body.latitude;
    const userLongitude = req.body.longitude;
    const position = req.body.position;

    console.log('Parameters:', { userLatitude, userLongitude, position });

    // Calculate object position from user location + vector
    const processedData = await processAssetData(
      userLatitude,
      userLongitude,
      position
    );

    return res.json({
      message: 'Object position calculated successfully',
      data: processedData,
      timestamp: new Date().toISOString()
    });

  } catch(error) {
    console.error('Error processing data:', error);
    return res.status(500).json({
      message: 'Error processing data',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '🚀 Simple Express.js TypeSc ript Server with Supabase!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      hello: '/hello',
      users: '/users',
      products: '/products',
      rawFrontend: '/rawfrontend',
      receiveData: '/receive_data_about_assets'
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

// RawFrontend endpoints
app.get('/rawfrontend', async (req: Request, res: Response) => {
  try {
    const rawFrontendRepo = AppDataSource.getRepository(RawFrontend);
    const records = await rawFrontendRepo.find();

    return res.json({
      message: 'RawFrontend records retrieved successfully',
      count: records.length,
      data: records,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching RawFrontend records:', error);
    return res.status(500).json({
      message: 'Error fetching RawFrontend records',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/rawfrontend/:id', async (req: Request, res: Response) => {
  try {
    const rawFrontendRepo = AppDataSource.getRepository(RawFrontend);
    const record = await rawFrontendRepo.findOne({
      where: { objectid: parseInt(req.params.id) }
    });

    if (!record) {
      return res.status(404).json({
        message: 'RawFrontend record not found',
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      message: 'RawFrontend record retrieved successfully',
      data: record,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching RawFrontend record:', error);
    return res.status(500).json({
      message: 'Error fetching RawFrontend record',
      timestamp: new Date().toISOString()
    });
  }
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
server.listen(port, '127.0.0.1', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health: http://localhost:${port}/health`);
  console.log(`👋 Hello: http://localhost:${port}/hello`);
  console.log(`👥 Users: http://localhost:${port}/users`);
  console.log(`🛍️ Products: http://localhost:${port}/products`);
  console.log(`📦 RawFrontend: http://localhost:${port}/rawfrontend`);
  console.log(`📥 Receive Data: http://localhost:${port}/receive_data_about_assets`);
  console.log(`🔌 WebSocket: ws://localhost:${port}/socket.io/`);
  console.log(`🌍 Network: http://[YOUR_IP]:${port}`);
});