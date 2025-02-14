const express = require('express');
const youtubedl = require('youtube-dl-exec');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Initialize the Express app
const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
    origin: 'https://vdonet.netlify.app', // Allow requests from your Netlify frontend
    credentials: true,
}));

// Ensure the downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Track the number of active downloads
let activeDownloads = 0;
const MAX_ACTIVE_DOWNLOADS = 5;

// Function to fetch cookies using Puppeteer
async function fetchCookies() {
    const browser = await puppeteer.launch({
        headless: true, // Run in headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for server environments
    });
    const page = await browser.newPage();

    // Navigate to YouTube and log in
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

    // Perform login (replace with your credentials)
    await page.type('input[type="email"]', 'ankit0.113jain@gmail.com'); // Enter your email
    await page.click('#identifierNext');
    await page.waitForTimeout(2000); // Wait for the password field to appear
    await page.type('input[type="password"]', 'Book2231042@'); // Enter your password
    await page.click('#passwordNext');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Extract cookies
    const cookies = await page.cookies();
    await browser.close();

    // Convert cookies to the format required by yt-dlp
    const cookiesString = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');

    return cookiesString;
}

// Endpoint for progress updates
app.get('/api/video/progress', async (req, res) => {
    const { videoLink, format = 'mp4' } = req.query;

    console.log("Received request for progress updates:", videoLink, "Format:", format);

    if (!videoLink) {
        console.error("Video link is required");
        return res.status(400).json({ error: "Video link is required" });
    }

    // Validate the video link
    const isValidLink = videoLink.includes('youtube.com') || videoLink.includes('youtu.be') || videoLink.includes('instagram.com');
    if (!isValidLink) {
        console.error("Invalid or unsupported video link:", videoLink);
        return res.status(400).json({ error: "Invalid or unsupported video link" });
    }

    // Check if the maximum number of active downloads has been reached
    if (activeDownloads >= MAX_ACTIVE_DOWNLOADS) {
        console.error("Maximum number of active downloads reached");
        return res.status(429).json({ error: "Server is busy. Please try again later." });
    }

    // Increment the active downloads counter
    activeDownloads++;
    console.log(`Active downloads: ${activeDownloads}`);

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate a unique filename
    const filename = `video_${Date.now()}.${format}`;
    const filePath = path.join(downloadsDir, filename);

    try {
        // Fetch fresh cookies using Puppeteer
        const cookies = await fetchCookies();

        // Options for youtube-dl-exec
        const options = {
            format: format === 'mp3' ? 'bestaudio' : 'best',
            output: filePath,
            quiet: true,
            noWarnings: true,
            addHeader: ['referer:https://www.instagram.com'],
            cookies: cookies, // Use the dynamically fetched cookies
        };

        // Use youtube-dl-exec to download the video
        const process = youtubedl.exec(videoLink, options);

        console.log("Starting download process...");

        // Send progress updates to the client
        process.stderr.on('data', (data) => {
            console.error("yt-dlp stderr:", data.toString());
            const progressMatch = data.toString().match(/\[download\]\s+(\d+\.\d+)%/);
            if (progressMatch) {
                const progress = parseFloat(progressMatch[1]);
                res.write(`data: ${JSON.stringify({ progress })}\n\n`);
            }
        });

        // Handle errors
        process.on('error', (error) => {
            console.error("❌ Error downloading video:", error);
            res.write(`data: ${JSON.stringify({ error: "Failed to process the request" })}\n\n`);
            res.end();
            activeDownloads--;
            console.log(`Active downloads: ${activeDownloads}`);
        });

        process.on('close', (code) => {
            console.log("Download process closed with code:", code);
            if (code === 0) {
                const downloadLink = `https://vdo-com.onrender.com/api/video/download?filename=${filename}`;
                res.write(`data: ${JSON.stringify({ completed: true, downloadLink })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ error: "Download failed. Please check the link or try again later." })}\n\n`);
            }
            res.end();
            activeDownloads--;
            console.log(`Active downloads: ${activeDownloads}`);
        });
    } catch (error) {
        console.error("❌ Error fetching cookies:", error);
        res.write(`data: ${JSON.stringify({ error: "Failed to fetch cookies. Please try again later." })}\n\n`);
        res.end();
        activeDownloads--;
        console.log(`Active downloads: ${activeDownloads}`);
    }
});

// Endpoint to download the file
app.get('/api/video/download', (req, res) => {
    const { filename } = req.query;

    if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
    }

    const filePath = path.join(downloadsDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    // Set headers for the download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
});

// Start the server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});