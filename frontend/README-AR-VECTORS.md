# CourseLens AR Vector System

## Overview

This system calculates precise relative vectors from the current user's position to AR assets, accounting for the original creator's position and the Earth's curvature using ECEF (Earth-Centered, Earth-Fixed) coordinate transformations.

## How It Works

### 1. **Asset Creation (Backend: `index.ts`)**
When a user places an AR asset:
```javascript
POST /receive_data_about_assets
{
  userLatitude: 49.2781,
  userLongitude: -122.9199,
  position: [2.5, 1.0, 0.5] // ENU vector from user to asset (e, n, u in meters)
}
```

- **Creator position** is refined using SQL `triangulate_coordinate` function
- **Asset position** is calculated from refined user position + ENU vector
- Both positions are stored in `rawfrontend` table with PostGIS geometry columns

### 2. **Asset Discovery (Backend: `socketHandler.ts`)**
When a user moves out of bounds (>50m from initial position):

```javascript
socket.on('off_boundaries', (data) => {
  // data.assets contains array of nearby assets with vector_relative
});
```

**Process:**
1. Query `rawfrontend` table for assets within 100m radius
2. For each asset, use `computeAssetPlacementVector()` from `reverseVectorAlgorithm.ts`
3. Calculate relative vector from **current user** → **asset** accounting for:
   - Original creator's position
   - Asset's absolute position
   - Earth's curvature (via ECEF transformations)
   - Current user's refined position

### 3. **Vector Calculation Algorithm**

The `computeAssetPlacementVector()` function:

```typescript
computeAssetPlacementVector(
  creator: { lat, lon, h },      // Original user who placed asset
  user: { lat, lon, h },          // Current user viewing the asset
  vCA_relative: { e, n, u }       // Original creator→asset vector
): { e, n, u }                    // New user→asset vector
```

**Steps:**
1. Convert creator position to ECEF coordinates
2. Apply original vector in creator's local ENU frame → get asset's ECEF position
3. Convert current user position to ECEF coordinates
4. Calculate ECEF delta: asset - current user
5. Rotate into current user's local ENU frame
6. Return relative vector (e=East, n=North, u=Up in meters)

## Frontend Integration

### Basic Setup

```html
<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
<script src="./client.js"></script>
```

### WebSocket Events

#### Connection
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

#### Send Position Updates
```javascript
navigator.geolocation.watchPosition((position) => {
  socket.emit('user_position', {
    lat: position.coords.latitude,
    lon: position.coords.longitude
  });
});
```

#### Receive Assets with Vectors
```javascript
socket.on('off_boundaries', (data) => {
  data.assets.forEach(asset => {
    const vec = asset.vector_relative; // { e, n, u } in meters
    placeAssetInAR(asset.id, vec);
  });
});
```

### AR Engine Integration

#### AR.js + A-Frame
```javascript
function placeAssetInAR(asset) {
  const vec = asset.vector_relative;
  const entity = document.createElement('a-entity');
  
  // ENU to A-Frame coordinates (Right-hand system: X=East, Y=Up, Z=-North)
  entity.setAttribute('position', `${vec.e} ${vec.u} ${-vec.n}`);
  entity.setAttribute('gltf-model', asset.glb_data);
  
  document.querySelector('a-scene').appendChild(entity);
}
```

#### Three.js
```javascript
async function placeAssetInAR(asset) {
  const vec = asset.vector_relative;
  const loader = new GLTFLoader();
  
  const model = await loader.loadAsync(asset.glb_data);
  model.position.set(vec.e, vec.u, -vec.n); // X=East, Y=Up, Z=-North
  
  scene.add(model);
}
```

#### Unity WebGL
```javascript
function placeAssetInAR(asset) {
  const vec = asset.vector_relative;
  
  unityInstance.SendMessage('ARManager', 'PlaceObject', JSON.stringify({
    id: asset.id,
    position: { x: vec.e, y: vec.u, z: -vec.n }, // Unity: X=East, Y=Up, Z=-North
    modelUrl: asset.glb_data
  }));
}
```

## Data Flow

```
User Movement
    ↓
GPS Position
    ↓
[Triangulate/Refine]
    ↓
WebSocket: emit('user_position')
    ↓
Backend: Check distance from initial position
    ↓
[>50m] Out of Bounds Detected
    ↓
Query rawfrontend table (100m radius)
    ↓
For each asset:
  - Load creator position (userLatitude, userLongitude)
  - Load asset position (objectLatitude, objectLongitude)
  - Load original vector (coordinates array)
  - Calculate: computeAssetPlacementVector(creator, currentUser, originalVector)
    ↓
WebSocket: emit('off_boundaries', { assets: [...] })
    ↓
Frontend: Receive assets with vector_relative
    ↓
Place in AR scene using (e, n, u) coordinates
```

## Asset Data Structure

```typescript
interface Asset {
  id: number;
  name: string;
  latitude: number;              // Asset's actual latitude
  longitude: number;             // Asset's actual longitude
  altitude: number;              // Asset's altitude (meters)
  creator_latitude: number;      // Original placer's latitude
  creator_longitude: number;     // Original placer's longitude
  creator_altitude: number;      // Original placer's altitude
  distance_meters: number;       // Distance from current user
  vector_relative: {             // ⭐ THE MAGIC: Relative vector to place asset
    e: number;                   // East offset in meters
    n: number;                   // North offset in meters
    u: number;                   // Up offset in meters
  };
  glb_data: string;             // GLB model URL or data
  category: string;             // Asset category
}
```

## Coordinate Systems

### ENU (East-North-Up)
- **e (East)**: Positive = East, Negative = West
- **n (North)**: Positive = North, Negative = South
- **u (Up)**: Positive = Up, Negative = Down

### Mapping to AR Engines
Most 3D engines use **right-hand coordinate systems**:
- **X axis** = East (e)
- **Y axis** = Up (u)
- **Z axis** = -North (-n) [negative because looking towards North is -Z]

## Testing

### 1. Start Backend
```bash
cd CampusLens/BackendTest
npm install
npm run dev
```

### 2. Start Frontend
```bash
cd CampusLens/frontend
npm start
# or
python3 -m http.server 8080
```

### 3. Open Browser
```
http://localhost:8080/client.html
```

### 4. Test Flow
1. Allow GPS permissions
2. Initial position recorded (state: accept)
3. Walk >50 meters away
4. `off_boundaries` event triggers
5. Assets appear with relative vectors
6. Check console for vector values

## Database Schema

```sql
-- RawFrontend table stores assets
CREATE TABLE public.rawfrontend (
  objectid SERIAL PRIMARY KEY,
  objectlatitude DOUBLE PRECISION NOT NULL,  -- Asset position
  objectlongitude DOUBLE PRECISION NOT NULL,
  object_location GEOMETRY(Point, 4326),     -- PostGIS geometry
  userlatitude DOUBLE PRECISION NOT NULL,    -- Creator position
  userlongitude DOUBLE PRECISION NOT NULL,
  user_location GEOMETRY(Point, 4326),       -- PostGIS geometry
  coordinates DOUBLE PRECISION[]             -- Original vector [lat, lon, h]
);
```

## Precision

- Uses `decimal.js` for high-precision arithmetic
- ECEF transformations use WGS84 ellipsoid parameters
- Coordinate refinement via SQL `triangulate_coordinate` function
- PostGIS for spatial queries and distance calculations

## Troubleshooting

### Assets not appearing?
- Check if assets exist in `rawfrontend` table
- Verify GPS accuracy (<50m)
- Check 100m search radius is appropriate
- Look for errors in browser console

### Vectors seem wrong?
- Verify creator position was stored correctly
- Check original vector in `coordinates` array
- Test with known positions first
- Use `computeAssetPlacementVectorWithDebug()` for detailed logs

### Performance issues?
- Limit asset query radius
- Add spatial index: `CREATE INDEX idx_object_location ON rawfrontend USING GIST(object_location);`
- Reduce position update frequency
- Batch vector calculations

## Advanced: Custom Vector Calculations

If you need to customize the vector calculation:

```typescript
import { computeAssetPlacementVector } from './services/reverseVectorAlgorithm';

const customVector = computeAssetPlacementVector(
  { lat: 49.2781, lon: -122.9199, h: 370 },  // Creator
  { lat: 49.2790, lon: -122.9180, h: 370 },  // Current user
  { e: 2.5, n: 1.0, u: 0.5 }                 // Original vector
);

console.log(customVector); // { e: ..., n: ..., u: ... }
```

## License

MIT License - See LICENSE file for details

