const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

// Track active downloads
let activeDownloads = 0;
const MAX_ACTIVE_DOWNLOADS = 5;

/**
 * Downloads Instagram Reel
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const downloadInstagramReel = async (req, res) => {
    const { url } = req.query;

    // Validate URL
    if (!url || !url.includes('instagram.com/reel/') && !url.includes('instagram.com/p/')) {
        return res.status(400).json({ error: "Invalid Instagram Reel URL" });
    }

    // Check if server is busy
    if (activeDownloads >= MAX_ACTIVE_DOWNLOADS) {
        return res.status(429).json({ error: "Server busy. Try again later." });
    }

    activeDownloads++;
    console.log(`📥 Active Downloads: ${activeDownloads}`);

    try {
        // Step 1: Extract video info
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            addHeader: [
                'referer:instagram.com',
                'origin:instagram.com'
            ]
        });

        // Step 2: Get best quality video URL
        const videoUrl = info.url || (info.formats && info.formats[info.formats.length - 1]?.url);
        if (!videoUrl) {
            throw new Error("No video URL found.");
        }

        // Step 3: Generate filename
        const filename = `reel_${Date.now()}.mp4`;
        const filePath = path.join(__dirname, '../downloads', filename);

        // Step 4: Download the video
        await youtubedl.exec(videoUrl, {
            output: filePath,
            noWarnings: true,
            addHeader: [
                'referer:instagram.com',
                'origin:instagram.com'
            ]
        });

        // Step 5: Send download link
        const downloadLink = `${req.protocol}://${req.get('host')}/api/download?filename=${filename}`;
        res.json({ success: true, downloadLink });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: "Failed to download reel." });
    } finally {
        activeDownloads--;
        console.log(`📥 Active Downloads: ${activeDownloads}`);
    }
};

/**
 * Handles file download
 * @param {Request} req 
 * @param {Response} res 
 */
const downloadFile = (req, res) => {
    const { filename } = req.query;

    if (!filename) {
        return res.status(400).json({ error: "Filename is required." });
    }

    const filePath = path.join(__dirname, '../downloads', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found." });
    }

    res.download(filePath, (err) => {
        if (err) {
            console.error("❌ Download failed:", err);
            res.status(500).json({ error: "Download failed." });
        } else {
            // Delete file after download
            fs.unlink(filePath, (err) => {
                if (err) console.error("⚠️ Could not delete file:", err);
            });
        }
    });
};

module.exports = { downloadInstagramReel, downloadFile };