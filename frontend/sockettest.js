const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// to note:
// socket.on is for receiving events
// socket.emit is for sending events

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('user_position', { "lat": 49.28, "lon": -122.91 });
});
// ^ that format is good

socket.on('welcome', (data) => {
  console.log('Welcome:', JSON.stringify(data));
});
// ^ doing stringify is ugly

socket.on('position_status', (data) => {
  console.log('Position update:', data);
});

socket.on('off_boundaries', (data) => {
  console.log('Off boundaries:', data);
});

socket.emit('ping', {info: 'test from client'});

//socket.disconnect();
