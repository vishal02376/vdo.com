// config/config.js
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

module.exports = {
    PORT: process.env.PORT,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
};
