const express = require('express');
const youtubedl = require('youtube-dl-exec');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://vdonet.netlify.app', // Allow requests from your Netlify frontend
    credentials: true,
}));

// Track the number of active downloads
let activeDownloads = 0;
const MAX_ACTIVE_DOWNLOADS = 5; // Set the maximum number of simultaneous downloads

// Endpoint for progress updates
app.get('/api/video/progress', (req, res) => {
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

    // Use youtube-dl-exec to download the video
    const process = youtubedl.exec(videoLink, {
        format: format === 'mp3' ? 'bestaudio' : 'best', // Use 'best' for best format
        output: '-', // Stream output to stdout
        quiet: true, // Suppress unnecessary logs
        noWarnings: true, // Suppress warnings
        addHeader: ['referer:https://www.instagram.com'], // Add referer header
        cookies: path.join(__dirname, 'cookies.txt'), // Use absolute path for cookies
    });

    console.log("Starting download process...");

    // Send progress updates to the client
    process.stderr.on('data', (data) => {
        console.error("yt-dlp stderr:", data.toString()); // Log stderr output
        const progressMatch = data.toString().match(/\[download\]\s+(\d+\.\d+)%/);
        if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            res.write(`data: ${JSON.stringify({ progress })}\n\n`); // Send progress to client
        }
    });

    // Stream the output directly to the response
    process.stdout.pipe(res);

    // Handle errors
    process.on('error', (error) => {
        console.error("❌ Error downloading video:", error);
        res.write(`data: ${JSON.stringify({ error: "Failed to process the request" })}\n\n`);
        res.end();

        // Decrement the active downloads counter
        activeDownloads--;
        console.log(`Active downloads: ${activeDownloads}`);
    });

    process.on('close', (code) => {
        console.log("Download process closed with code:", code);
        if (code === 0) {
            res.write(`data: ${JSON.stringify({ completed: true })}\n\n`); // Send completion event
        } else {
            res.write(`data: ${JSON.stringify({ error: "Download failed" })}\n\n`); // Send error event
        }
        res.end(); // End the SSE connection

        // Decrement the active downloads counter
        activeDownloads--;
        console.log(`Active downloads: ${activeDownloads}`);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});