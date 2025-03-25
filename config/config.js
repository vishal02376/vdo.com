// config/config.js
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

module.exports = {
    PORT: process.env.PORT,
   
};
