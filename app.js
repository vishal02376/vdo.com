const express = require('express');
const { downloadInstagramReel, downloadFile } = require('./controllers/videoController');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/instagram/reel', downloadInstagramReel);
app.get('/api/download', downloadFile);

// Start server
app.listen(5000, () => console.log('Server running on port 5000 🚀'));