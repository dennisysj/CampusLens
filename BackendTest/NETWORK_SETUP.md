# 🌍 Network Access Setup

This guide shows you how to make your Express.js server accessible to other devices on your network.

## 🚀 Quick Setup

### 1. **Local Network Access (Same WiFi)**

```bash
# Get your network information
npm run network:info

# Start the server for network access
npm run dev:network
```

The server will now be accessible at:
- **Your computer**: `http://localhost:3000`
- **Other devices**: `http://[YOUR_IP]:3000`

### 2. **Find Your IP Address**

```bash
# On macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# On Windows
ipconfig | findstr "IPv4"
```

## 🔧 Configuration

### **Server Configuration**
The server is already configured to accept connections from any IP address (`0.0.0.0`).

### **Firewall Settings**

#### **macOS:**
```bash
# Allow incoming connections on port 3000
sudo pfctl -f /etc/pf.conf
```

#### **Windows:**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Add Node.js or your terminal application

#### **Linux:**
```bash
# Allow port 3000 through firewall
sudo ufw allow 3000
```

## 🌐 External Access (Internet)

### **Option 1: ngrok (Recommended)**

1. **Install ngrok:**
```bash
# Download from https://ngrok.com/download
# Or via Homebrew (macOS)
brew install ngrok
```

2. **Start your server:**
```bash
npm run dev
```

3. **In another terminal, create tunnel:**
```bash
ngrok http 3000
```

4. **Share the ngrok URL** (e.g., `https://abc123.ngrok.io`)

### **Option 2: Cloudflare Tunnel**

1. **Install cloudflared:**
```bash
# macOS
brew install cloudflared

# Or download from https://github.com/cloudflare/cloudflared/releases
```

2. **Create tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

### **Option 3: localtunnel**

1. **Install:**
```bash
npm install -g localtunnel
```

2. **Create tunnel:**
```bash
lt --port 3000
```

## 📱 Testing Network Access

### **From Another Device:**

1. **Connect to the same WiFi network**
2. **Open browser and visit:**
   - `http://[YOUR_IP]:3000`
   - `http://[YOUR_IP]:3000/health`
   - `http://[YOUR_IP]:3000/api`

### **Test WebSocket:**
- Visit `http://[YOUR_IP]:3000/index.html` on any device
- Test real-time communication

## 🔍 Troubleshooting

### **Common Issues:**

1. **"Connection refused"**
   - Check if server is running on `0.0.0.0:3000`
   - Verify firewall settings
   - Ensure devices are on same network

2. **"Can't reach server"**
   - Check IP address is correct
   - Try disabling VPN
   - Restart router if needed

3. **WebSocket not working**
   - Check CORS settings
   - Ensure WebSocket URL uses correct IP

### **Network Commands:**

```bash
# Check if port is open
netstat -an | grep 3000

# Test connection
curl http://[YOUR_IP]:3000/health

# Check network interfaces
ifconfig
```

## 🛡️ Security Notes

- **Local network access** is relatively safe for development
- **External tunnels** (ngrok, etc.) make your server publicly accessible
- **Never expose production servers** without proper security measures
- **Use HTTPS** for external access when possible

## 📋 Quick Commands

```bash
# Start server for network access
npm run dev:network

# Get network information
npm run network:info

# Setup network access
npm run network:setup

# Start with ngrok (after installing)
ngrok http 3000
```

## 🎯 URLs to Share

Once running, share these URLs with your team:

- **Main server**: `http://[YOUR_IP]:3000`
- **Health check**: `http://[YOUR_IP]:3000/health`
- **API documentation**: `http://[YOUR_IP]:3000`
- **WebSocket test**: `http://[YOUR_IP]:3000/index.html`
- **Users API**: `http://[YOUR_IP]:3000/api/users`
- **Products API**: `http://[YOUR_IP]:3000/api/products`
