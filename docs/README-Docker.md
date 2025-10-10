# CampusLens Docker Setup

This document explains how to set up and run the CampusLens PostgreSQL database using Docker with local network tunneling.

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of available RAM (for the large raster dataset)
- Ports 5432 and 8080 available on your local machine

## Quick Start

1. **Build and start the containers:**
   ```bash
   docker-compose up --build -d
   ```

2. **Check container status:**
   ```bash
   docker-compose ps
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f postgres
   ```

## Services

### PostgreSQL Database
- **Container**: `campuslens-postgres`
- **Port**: 5432 (mapped to localhost:5432)
- **Database**: `campuslens`
- **User**: `campuslens`
- **Password**: `campuslens123`
- **Network IP**: `172.20.0.2`

### PgAdmin (Database Management)
- **Container**: `campuslens-pgadmin`
- **Port**: 8080 (mapped to localhost:8080)
- **URL**: http://localhost:8080
- **Email**: admin@campuslens.com
- **Password**: admin123

## Network Configuration

The setup creates a custom Docker network (`campuslens-network`) with the following configuration:

- **Network Name**: `campuslens-network`
- **Subnet**: `172.20.0.0/16`
- **Driver**: Bridge
- **PostgreSQL IP**: `172.20.0.2`

## Database Features

### PostGIS Extensions
- PostGIS for spatial data
- PostGIS Raster for terrain data
- PostGIS Topology for advanced spatial operations
- Fuzzy string matching for search

### CampusLens Schema
- **Users**: User management
- **Locations**: Campus points of interest
- **Events**: Campus events and activities
- **Courses**: Course catalog
- **Course Schedules**: Class schedules with locations
- **Notifications**: User notifications
- **SFU Raster**: High-resolution terrain data

### Spatial Functions
- `find_nearby_locations()`: Find locations within a radius
- `get_elevation_at_point()`: Get elevation at specific coordinates
- `get_elevation_profile()`: Get elevation profile along a path

## Connecting to the Database

### From your application:
```javascript
const connectionString = 'postgresql://campuslens:campuslens123@localhost:5432/campuslens';
```

### From command line:
```bash
psql -h localhost -p 5432 -U campuslens -d campuslens
```

### From PgAdmin:
1. Open http://localhost:8080
2. Login with admin@campuslens.com / admin123
3. Add new server:
   - Host: `campuslens-postgres`
   - Port: 5432
   - Database: campuslens
   - Username: campuslens
   - Password: campuslens123

## Data Loading

The setup automatically loads:
1. Database schema and sample data
2. SFU raster terrain data (1.5GB+ dataset)
3. Spatial indexes for optimal performance

## Troubleshooting

### Container won't start:
```bash
# Check logs
docker-compose logs postgres

# Rebuild containers
docker-compose down
docker-compose up --build -d
```

### Database connection issues:
```bash
# Check if PostgreSQL is ready
docker-compose exec postgres pg_isready -U campuslens

# Check network connectivity
docker-compose exec postgres ping campuslens-pgadmin
```

### Raster data not loading:
```bash
# Check if the dataset file exists
docker-compose exec postgres ls -la /docker-entrypoint-initdb.d/dataset/

# Manually load raster data
docker-compose exec postgres psql -U campuslens -d campuslens -f /docker-entrypoint-initdb.d/dataset/sfu_raster.sql
```

## Performance Optimization

### For large datasets:
- Ensure Docker has at least 4GB RAM allocated
- Use SSD storage for better I/O performance
- Consider using Docker volumes for persistent data

### Database tuning:
```sql
-- Increase shared buffers for large raster data
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

## Stopping the Services

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (WARNING: This will delete all data)
docker-compose down -v
```

## Development

### Accessing the database directly:
```bash
# Connect to PostgreSQL container
docker-compose exec postgres bash

# Run SQL commands
docker-compose exec postgres psql -U campuslens -d campuslens
```

### Backup and restore:
```bash
# Backup
docker-compose exec postgres pg_dump -U campuslens campuslens > backup.sql

# Restore
docker-compose exec -T postgres psql -U campuslens -d campuslens < backup.sql
```
