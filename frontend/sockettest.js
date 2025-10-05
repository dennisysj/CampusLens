const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('user_position', { "lat": 49.28, "lon": -122.91 });
});

socket.on('welcome', (data) => {
  console.log('Welcome:', JSON.stringify(data));
});

socket.on('position_status', (data) => {
  console.log('Position update:', data);
});

socket.on('off_boundaries', (data) => {
  console.log('Off boundaries:', data);
});
