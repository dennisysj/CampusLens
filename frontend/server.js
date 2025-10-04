const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.use(express.static('public'));

app.listen(3000, () => {
  console.log('Server is running on port 3000. http://localhost:3000');
});