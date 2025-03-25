const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Track active downloads
let activeDownloads = 0;
const MAX_ACTIVE_DOWNLOADS = 5;

const downloadInstagramReel = async (req, res) => {
    const { url } = req.query;

    if (!url || (!url.includes('instagram.com/reel/') && !url.includes('instagram.com/p/'))) {
        return res.status(400).json({ error: "Invalid Instagram Reel URL" });
    }

    if (activeDownloads >= MAX_ACTIVE_DOWNLOADS) {
        return res.status(429).json({ error: "Server busy. Please try again later." });
    }

    activeDownloads++;
    console.log(`📥 Active Downloads: ${activeDownloads}`);

    try {
        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, '../downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir);
        }

        // Generate filename
        const filename = `reel_${Date.now()}.mp4`;
        const filePath = path.join(downloadsDir, filename);

        console.log("⬇️ Starting download...");
        
        // Using yt-dlp directly
        const command = `yt-dlp "${url}" -f best -o "${filePath}" --add-header "Referer:https://www.instagram.com" --add-header "Origin:https://www.instagram.com" --no-check-certificate`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Download failed:", error);
                return res.status(500).json({ 
                    error: "Failed to download reel",
                    details: error.message
                });
            }
            
            if (stderr) {
                console.error("⚠️ Warning:", stderr);
            }

            console.log("✅ Download complete:", stdout);
            const downloadLink = `${req.protocol}://${req.get('host')}/api/download?filename=${filename}`;
            res.json({ 
                success: true, 
                downloadLink,
                info: {
                    filename: filename,
                    message: "Download completed successfully"
                }
            });
        });

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ 
            error: "An unexpected error occurred",
            details: error.message
        });
    } finally {
        activeDownloads--;
        console.log(`📥 Active Downloads: ${activeDownloads}`);
    }
};

const downloadFile = (req, res) => {
    const { filename } = req.query;

    if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
    }

    const filePath = path.join(__dirname, '../downloads', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error("❌ Download failed:", err);
        } else {
            // Delete file after successful download
            fs.unlink(filePath, (err) => {
                if (err) console.error("⚠️ Error deleting file:", err);
                else console.log("🗑️ File deleted successfully");
            });
        }
    });
};

module.exports = { 
    downloadInstagramReel,  
    downloadFile 
};