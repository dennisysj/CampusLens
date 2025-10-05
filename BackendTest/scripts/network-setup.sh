#!/bin/bash

# Network Setup Script for Express.js Server
echo "🌍 Setting up network access for your Express.js server..."

# Get the local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
PORT=${PORT:-3000}
DB_PORT=15432  # or your actual Postgres local port
DB_USER=campuslens
DB_PASS=campuslens123
DB_NAME=campuslens

CONN_STRING="postgresql://$DB_USER:$DB_PASS@$LOCAL_IP:$DB_PORT/$DB_NAME"

echo "📍 Your local IP address: $LOCAL_IP"
echo "🔌 Server port: $PORT"
echo ""
echo "🔗 Network URLs:"
echo "   Local access: http://localhost:$PORT"
echo "   Network access: http://$LOCAL_IP:$PORT"
echo ""
echo "📱 Share these URLs with people on your network:"
echo "   Main server: http://$LOCAL_IP:$PORT"
echo "   Health check: http://$LOCAL_IP:$PORT/health"
echo "   API: http://$LOCAL_IP:$PORT/api"
echo "   WebSocket test: http://$LOCAL_IP:$PORT/index.html"
echo ""
echo "🔧 Troubleshooting:"
echo "   1. Make sure your firewall allows connections on port $PORT"
echo "   2. Ensure all devices are on the same network"
echo "   3. Try disabling VPN if you have one"
echo ""
echo "🚀 To start the server, run: npm run dev"
