# Dockerfile for PostgreSQL with PostGIS extensions
FROM postgis/postgis:15-3.3

# Set environment variables
ENV POSTGRES_DB=campuslens
ENV POSTGRES_USER=campuslens
ENV POSTGRES_PASSWORD=campuslens123
ENV POSTGRES_HOST_AUTH_METHOD=trust

# Create directory for initialization scripts
RUN mkdir -p /docker-entrypoint-initdb.d

# Copy initialization script
COPY ./database/init.sql /docker-entrypoint-initdb.d/

# Copy raster data
COPY ./BackendTest/dataset/ /docker-entrypoint-initdb.d/dataset/

# Expose PostgreSQL port
EXPOSE 5432

# Set default command
CMD ["postgres"]
