const express = require('express');
const { downloadInstagramReel, downloadFile } = require('./controllers/videoController');
const cors = require('cors');
const app = express();
require('dotenv').config();


// Middleware
app.use(cors());
app.use(express.json());
let port = process.env.PORT || 8000
// Routes
app.get('/api/instagram/reel', downloadInstagramReel);
app.get('/api/download', downloadFile);

// Start server
app.listen(port, ()=>{
  console.log("Server is running on ther port", port)
})