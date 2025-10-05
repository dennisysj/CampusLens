-- Load SFU raster data into the database
-- This script loads the large raster dataset for campus terrain visualization

-- Create the raster table
CREATE TABLE IF NOT EXISTS sfu_raster (
    rid SERIAL PRIMARY KEY,
    rast RASTER
);

-- Load the raster data from the SQL file
-- Note: This assumes the sfu_raster.sql file has been processed
-- The actual data loading will be handled by the Docker entrypoint

-- Create spatial index on the raster
CREATE INDEX IF NOT EXISTS idx_sfu_raster_gist ON sfu_raster USING GIST (ST_ConvexHull(rast));

-- Add raster constraints
SELECT AddRasterConstraints('sfu_raster', 'rast', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE);

-- Analyze the table for better query performance
ANALYZE sfu_raster;

-- Create a function to get elevation at a specific point
CREATE OR REPLACE FUNCTION get_elevation_at_point(
    lat FLOAT,
    lon FLOAT
)
RETURNS FLOAT AS $$
DECLARE
    elevation FLOAT;
BEGIN
    SELECT ST_Value(rast, ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), ST_SRID(rast)))
    INTO elevation
    FROM sfu_raster
    WHERE ST_Intersects(rast, ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), ST_SRID(rast)))
    LIMIT 1;
    
    RETURN COALESCE(elevation, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get elevation profile along a path
CREATE OR REPLACE FUNCTION get_elevation_profile(
    path_coords GEOMETRY
)
RETURNS TABLE (
    point_index INTEGER,
    elevation FLOAT,
    coordinates GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    WITH path_points AS (
        SELECT 
            generate_series(1, ST_NPoints(path_coords)) as point_index,
            ST_PointN(path_coords, generate_series(1, ST_NPoints(path_coords))) as point_geom
    )
    SELECT 
        pp.point_index,
        COALESCE(ST_Value(sr.rast, ST_Transform(pp.point_geom, ST_SRID(sr.rast))), 0) as elevation,
        pp.point_geom as coordinates
    FROM path_points pp
    LEFT JOIN sfu_raster sr ON ST_Intersects(sr.rast, ST_Transform(pp.point_geom, ST_SRID(sr.rast)))
    ORDER BY pp.point_index;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on the raster table
GRANT ALL PRIVILEGES ON TABLE sfu_raster TO campuslens;
GRANT ALL PRIVILEGES ON SEQUENCE sfu_raster_rid_seq TO campuslens;
