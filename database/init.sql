-- Database initialization script for CampusLens
-- This script sets up the database schema and loads the SFU raster data

-- Enable PostGIS extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- Create the main database schema
CREATE SCHEMA IF NOT EXISTS campuslens;

-- Set search path
SET search_path TO campuslens, public;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create locations table for campus points of interest
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    coordinates GEOMETRY(POINT, 4326),
    floor_level INTEGER DEFAULT 0,
    building VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for locations
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON locations USING GIST (coordinates);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location_id INTEGER REFERENCES locations(id),
    coordinates GEOMETRY(POINT, 4326),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for events
CREATE INDEX IF NOT EXISTS idx_events_coordinates ON events USING GIST (coordinates);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    description TEXT,
    credits INTEGER,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create course_schedules table
CREATE TABLE IF NOT EXISTS course_schedules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    coordinates GEOMETRY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for course_schedules
CREATE INDEX IF NOT EXISTS idx_course_schedules_coordinates ON course_schedules USING GIST (coordinates);

-- Create user_courses table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_courses (
    user_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_course_schedules_day_time ON course_schedules(day_of_week, start_time);

-- Insert sample data
INSERT INTO locations (name, description, category, coordinates, building) VALUES
('SFU Library', 'Main campus library with study spaces and resources', 'academic', ST_SetSRID(ST_MakePoint(-122.9183, 49.2781), 4326), 'Library'),
('Convocation Mall', 'Main gathering area in the center of campus', 'outdoor', ST_SetSRID(ST_MakePoint(-122.9195, 49.2775), 4326), 'Outdoor'),
('AQ Building', 'Academic Quadrangle with classrooms and offices', 'academic', ST_SetSRID(ST_MakePoint(-122.9201, 49.2778), 4326), 'AQ'),
('Student Union Building', 'Student services and food court', 'services', ST_SetSRID(ST_MakePoint(-122.9188, 49.2772), 4326), 'SUB');

-- Insert sample courses
INSERT INTO courses (course_code, course_name, description, credits, department) VALUES
('CMPT 300', 'Operating Systems I', 'Introduction to operating system concepts', 3, 'Computing Science'),
('CMPT 354', 'Database Systems I', 'Introduction to database design and implementation', 3, 'Computing Science'),
('MATH 150', 'Calculus I', 'Differential and integral calculus', 3, 'Mathematics'),
('ENGL 101', 'Introduction to University Writing', 'Academic writing and research skills', 3, 'English');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to find nearby locations
CREATE OR REPLACE FUNCTION find_nearby_locations(
    user_lat FLOAT,
    user_lon FLOAT,
    radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR(100),
    description TEXT,
    category VARCHAR(50),
    distance_meters FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.description,
        l.category,
        ST_Distance(
            ST_Transform(l.coordinates, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326), 3857)
        ) as distance_meters
    FROM locations l
    WHERE ST_DWithin(
        ST_Transform(l.coordinates, 3857),
        ST_Transform(ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326), 3857),
        radius_meters
    )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE campuslens TO campuslens;
GRANT ALL PRIVILEGES ON SCHEMA campuslens TO campuslens;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA campuslens TO campuslens;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA campuslens TO campuslens;

-- Load the SFU raster data if the file exists
-- Note: This will be handled by the Docker entrypoint script
