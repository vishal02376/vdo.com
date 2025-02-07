const express = require('express');
const { downloadVideo, getProgress } = require('../controllers/videoController'); // Ensure correct import

const router = express.Router();

// Register the download route
router.get('/download', downloadVideo);

// Register the progress route
router.get('/progress', getProgress);

module.exports = router;