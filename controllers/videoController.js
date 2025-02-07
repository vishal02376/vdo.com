const youtubedl = require('youtube-dl-exec');
const path = require('path');

// Function to handle progress updates
const getProgress = (req, res) => {
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

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Use youtube-dl-exec to download the video
    const process = youtubedl.exec(videoLink, {
        format: format === 'mp3' ? 'bestaudio' : 'best', // Use 'best' for best format
        output: '-', // Output to stdout
        quiet: true, // Suppress unnecessary logs
        noWarnings: true, // Suppress warnings
    });

    console.log("Starting download process...");

    // Send progress updates to the client
    process.stderr.on('data', (data) => {
        const progressMatch = data.toString().match(/\[download\]\s+(\d+\.\d+)%/);
        if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            res.write(`data: ${JSON.stringify({ progress })}\n\n`); // Send progress to client
        }
    });

    // Handle errors
    process.on('error', (error) => {
        console.error("❌ Error downloading video:", error);
        res.write(`data: ${JSON.stringify({ error: "Failed to process the request" })}\n\n`);
        res.end();
    });

    process.on('close', (code) => {
        console.log("Download process closed with code:", code);
        if (code === 0) {
            res.write(`data: ${JSON.stringify({ completed: true })}\n\n`); // Send completion event
        } else {
            res.write(`data: ${JSON.stringify({ error: "Download failed" })}\n\n`); // Send error event
        }
        res.end(); // End the SSE connection
    });
};

// Function to handle file download
const downloadVideo = (req, res) => {
    const { videoLink, format = 'mp4' } = req.query;

    console.log("Received request to download:", videoLink, "Format:", format);

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

    // Set headers for the download
    res.setHeader('Content-Disposition', `attachment; filename="video.${format}"`);
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    // Use youtube-dl-exec to download the video
    const process = youtubedl.exec(videoLink, {
        format: format === 'mp3' ? 'bestaudio' : 'best', // Use 'best' for best format
        output: '-', // Output to stdout
        quiet: true, // Suppress unnecessary logs
        noWarnings: true, // Suppress warnings
    });

    console.log("Starting download process...");

    // Stream the output directly to the response
    process.stdout.pipe(res);

    // Handle errors
    process.on('error', (error) => {
        console.error("❌ Error downloading video:", error);
        res.status(500).json({ error: "Failed to process the request" });
    });

    process.stderr.on('data', (data) => {
        console.error("❌ Error:", data.toString());
    });

    process.on('close', (code) => {
        console.log("Download process closed with code:", code);
        if (code !== 0) {
            res.status(500).json({ error: "Download failed" });
        }
    });
};

module.exports = { downloadVideo, getProgress }; // Export both functions