const express = require('express');
const path = require('path');
const app = express();

// Serve static files from public directory
app.use(express.static('public'));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Handle all other routes by serving the main HTML (for SPA behavior)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Export for Vercel
module.exports = app;
