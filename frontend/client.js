// CourseLens AR Client - WebSocket handler
(() => {
  const SERVER_URL = 'http://localhost:3000'; // Change to your server URL
  
  // DOM elements
  const $status = document.getElementById('connection-status');
  const $clientId = document.getElementById('client-id');
  const $position = document.getElementById('position');
  const $state = document.getElementById('state');
  const $assetCount = document.getElementById('asset-count');
  const $assetsContainer = document.getElementById('assets-container');
  const $logsContainer = document.getElementById('logs-container');

  // State
  let currentAssets = [];
  let watchId = null;

  // Initialize Socket.IO connection
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  // Logging utility
  function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
      <span class="log-time">[${timestamp}]</span> ${message}
      ${data ? `<br><pre style="margin-top: 5px; opacity: 0.8;">${JSON.stringify(data, null, 2)}</pre>` : ''}
    `;
    $logsContainer.insertBefore(logEntry, $logsContainer.firstChild);
    
    // Keep only last 20 logs
    while ($logsContainer.children.length > 20) {
      $logsContainer.removeChild($logsContainer.lastChild);
    }
    
    console.log(`[${timestamp}] ${message}`, data || '');
  }

  // Update connection status
  function updateStatus(status, text) {
    $status.className = `status ${status}`;
    $status.textContent = text;
  }

  // Render assets with relative vectors
  function renderAssets(assets) {
    currentAssets = assets;
    $assetCount.textContent = assets.length;

    if (assets.length === 0) {
      $assetsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div>No assets detected yet. Move around to discover AR objects!</div>
        </div>
      `;
      return;
    }

    $assetsContainer.innerHTML = assets.map(asset => {
      const vec = asset.vector_relative || { e: 0, n: 0, u: 0 };
      const distance = asset.distance_meters || 0;
      
      return `
        <div class="asset-card">
          <div class="asset-header">
            <div class="asset-name">${asset.name || 'Asset ' + asset.id}</div>
            <div class="asset-distance">${distance.toFixed(2)}m</div>
          </div>
          
          <div class="asset-details">
            <div class="detail-item">
              <div class="detail-label">Latitude</div>
              <div class="detail-value">${asset.latitude.toFixed(6)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Longitude</div>
              <div class="detail-value">${asset.longitude.toFixed(6)}</div>
            </div>
          </div>

          <div class="vector-display">
            <div class="vector-title">📍 Relative Vector (User → Asset)</div>
            <div class="vector-values">
              <div class="vector-component">
                <div class="vector-label">East (e)</div>
                <div class="vector-value">${vec.e.toFixed(2)}m</div>
              </div>
              <div class="vector-component">
                <div class="vector-label">North (n)</div>
                <div class="vector-value">${vec.n.toFixed(2)}m</div>
              </div>
              <div class="vector-component">
                <div class="vector-label">Up (u)</div>
                <div class="vector-value">${vec.u.toFixed(2)}m</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Call AR placement function for each asset
    assets.forEach(asset => {
      if (asset.vector_relative) {
        placeAssetInAR(asset);
      }
    });
  }

  // AR Placement function - integrate with your AR engine (e.g., AR.js, A-Frame, Three.js)
  function placeAssetInAR(asset) {
    const vec = asset.vector_relative;
    
    // This is where you integrate with your AR/3D rendering engine
    // Example integration points:
    
    // For AR.js + A-Frame:
    // const entity = document.createElement('a-entity');
    // entity.setAttribute('position', `${vec.e} ${vec.u} ${-vec.n}`);
    // entity.setAttribute('gltf-model', asset.glb_data);
    // scene.appendChild(entity);
    
    // For Three.js:
    // const object = await loadGLTF(asset.glb_data);
    // object.position.set(vec.e, vec.u, -vec.n);
    // scene.add(object);
    
    // For Unity WebGL:
    // unityInstance.SendMessage('ARManager', 'PlaceObject', JSON.stringify({
    //   id: asset.id,
    //   position: { x: vec.e, y: vec.u, z: -vec.n },
    //   modelUrl: asset.glb_data
    // }));
    
    log(`🎨 AR placement for asset ${asset.id}`, {
      vector: vec,
      distance: asset.distance_meters
    });
  }

  // Socket event handlers
  socket.on('connect', () => {
    updateStatus('connected', `Connected: ${socket.id}`);
    $clientId.textContent = socket.id;
    log('✅ Connected to server', { clientId: socket.id });

    // Start watching geolocation
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          // Update UI
          $position.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

          // Send to server
          socket.emit('user_position', { lat, lon });
          
          log(`📍 Position sent`, { lat, lon, accuracy: `${accuracy.toFixed(2)}m` });
        },
        (error) => {
          log(`❌ Geolocation error: ${error.message}`);
          $position.textContent = 'GPS unavailable';
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000
        }
      );
    } else {
      log('❌ Geolocation not supported by this browser');
      $position.textContent = 'GPS not supported';
    }
  });

  socket.on('disconnect', (reason) => {
    updateStatus('disconnected', 'Disconnected');
    log(`🔌 Disconnected: ${reason}`);
    
    // Stop watching geolocation
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  });

  socket.on('connect_error', (error) => {
    updateStatus('disconnected', 'Connection failed');
    log(`❌ Connection error: ${error.message}`);
  });

  socket.on('welcome', (data) => {
    log('👋 Welcome message received', data);
    $state.textContent = data.state || 'accept';
  });

  socket.on('position_status', (data) => {
    $state.textContent = data.state || '-';
    log(`📍 Position status: ${data.message}`, { state: data.state });
  });

  // MAIN EVENT: User went out of bounds, receive assets with relative vectors
  socket.on('off_boundaries', (data) => {
    log('🚨 Out of boundaries! New assets received', {
      assetCount: data.assets?.length || 0
    });
    
    $state.textContent = 'out_of_bounds';
    
    if (data.assets && data.assets.length > 0) {
      // Render assets with their relative vectors
      renderAssets(data.assets);
      
      log(`✅ Rendered ${data.assets.length} assets with relative vectors`);
    } else {
      renderAssets([]);
      log('⚠️ No assets found in the area');
    }
  });

  socket.on('error', (data) => {
    log(`❌ Server error: ${data.message}`, data.error);
  });

  // Initial log
  log('🚀 Client initialized');
  updateStatus('connecting', 'Connecting...');
})();

