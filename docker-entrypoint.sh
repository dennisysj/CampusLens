#!/bin/bash
set -e

# Custom entrypoint script for CampusLens PostgreSQL container
echo "Starting CampusLens PostgreSQL container..."

# Start PostgreSQL in the background
docker-entrypoint.sh postgres &
POSTGRES_PID=$!

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U campuslens; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done

echo "PostgreSQL is ready!"

# Load the raster data if the SQL file exists
if [ -f "/docker-entrypoint-initdb.d/dataset/sfu_raster.sql" ]; then
    echo "Loading SFU raster data..."
    psql -U campuslens -d campuslens -f /docker-entrypoint-initdb.d/dataset/sfu_raster.sql
    echo "SFU raster data loaded successfully!"
else
    echo "Warning: sfu_raster.sql not found, skipping raster data load"
fi

# Wait for the PostgreSQL process
wait $POSTGRES_PID
