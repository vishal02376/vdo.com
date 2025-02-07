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

    // Generate a unique filename
    const filename = `video_${Date.now()}.${format}`;
    const filePath = path.join(downloadsDir, filename);

    // Use youtube-dl-exec to download the video
    const process = youtubedl.exec(videoLink, {
        format: format === 'mp3' ? 'bestaudio' : 'best', // Use 'best' for best format
        output: filePath, // Save to the specified file path
        quiet: true, // Suppress unnecessary logs
        noWarnings: true, // Suppress warnings
        addHeader: ['referer:https://www.instagram.com'], // Add referer header
        cookies: 'cookies.txt', // Path to cookies file (if required)
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
            // Send the download link to the client
            const downloadLink = `https://vdo-com.onrender.com/api/video/download?filename=${filename}`;
            res.write(`data: ${JSON.stringify({ completed: true, downloadLink })}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ error: "Download failed" })}\n\n`);
        }
        res.end(); // End the SSE connection

        // Decrement the active downloads counter
        activeDownloads--;
        console.log(`Active downloads: ${activeDownloads}`);
    });
});