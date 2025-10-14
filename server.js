const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'excel-files';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from root

// Configure multer for memory storage (we'll upload to Supabase)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve Supabase config to frontend
app.get('/api/config', (req, res) => {
    res.json({
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
    });
});

// Get current file status
app.get('/api/status', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('uploaded_files')
            .select('*')
            .eq('is_current', true)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking file status:', error);
            return res.status(500).json({ error: 'Failed to check file status' });
        }

        if (!data) {
            return res.json({ exists: false });
        }

        res.json({
            exists: true,
            filename: data.filename,
            stats: {
                size: data.file_size,
                mtime: data.uploaded_at
            }
        });
    } catch (error) {
        console.error('Error checking file status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload file to Supabase Storage
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const password = req.headers['x-admin-password'];
    
    // Simple password check (you should replace this with Supabase Auth)
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filename = `current-${Date.now()}.xlsx`;
        const filePath = `uploads/${filename}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload file to storage' });
        }

        // Save file metadata to database
        const { data: fileData, error: dbError } = await supabase
            .from('uploaded_files')
            .insert({
                filename: req.file.originalname,
                storage_path: filePath,
                file_size: req.file.size,
                is_current: true
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            // Try to clean up the uploaded file
            await supabase.storage.from(BUCKET_NAME).remove([filePath]);
            return res.status(500).json({ error: 'Failed to save file metadata' });
        }

        res.json({
            success: true,
            message: 'File uploaded successfully',
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current file
app.get('/api/file', async (req, res) => {
    try {
        // Get current file metadata
        const { data: fileData, error: dbError } = await supabase
            .from('uploaded_files')
            .select('*')
            .eq('is_current', true)
            .single();

        if (dbError || !fileData) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Download from Supabase Storage
        const { data: fileBlob, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileData.storage_path);

        if (downloadError) {
            console.error('Download error:', downloadError);
            return res.status(500).json({ error: 'Failed to download file' });
        }

        // Convert Blob to Buffer for Express
        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete current file
app.delete('/api/file', async (req, res) => {
    const password = req.headers['x-admin-password'];
    
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get current file
        const { data: fileData, error: findError } = await supabase
            .from('uploaded_files')
            .select('*')
            .eq('is_current', true)
            .single();

        if (findError || !fileData) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([fileData.storage_path]);

        if (storageError) {
            console.error('Storage delete error:', storageError);
        }

        // Delete from database
        const { error: dbError } = await supabase
            .from('uploaded_files')
            .delete()
            .eq('id', fileData.id);

        if (dbError) {
            console.error('Database delete error:', dbError);
            return res.status(500).json({ error: 'Failed to delete file metadata' });
        }

        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all tracklists
app.get('/api/tracklist', async (req, res) => {
    try {
        const { data, error } = await supabase
            .rpc('get_tracklists_json');

        if (error) {
            console.error('Error reading tracklist:', error);
            return res.status(500).json({ error: 'Failed to read tracklist' });
        }

        res.json(data || {});
    } catch (error) {
        console.error('Error reading tracklist:', error);
        res.status(500).json({ error: 'Failed to read tracklist' });
    }
});

// Save tracklist (bulk upsert)
app.post('/api/tracklist', async (req, res) => {
    try {
        const tracklistData = req.body;
        
        // Convert from { "Artist": ["song1", "song2"] } to array of rows
        const rows = [];
        for (const [artist, songs] of Object.entries(tracklistData)) {
            songs.forEach((song, index) => {
                rows.push({
                    artist_name: artist,
                    song_name: song,
                    position: index + 1
                });
            });
        }

        // Always clear existing rows first to support full deletion when rows is empty
        const { error: deleteAllError } = await supabase
            .from('tracklists')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteAllError) {
            console.error('Error clearing tracklist:', deleteAllError);
            return res.status(500).json({ error: 'Failed to clear existing tracklist' });
        }

        if (rows.length === 0) {
            return res.json({ success: true, message: 'Tracklist cleared' });
        }

        // Insert new data
        const { error } = await supabase
            .from('tracklists')
            .insert(rows);

        if (error) {
            console.error('Error saving tracklist:', error);
            return res.status(500).json({ error: 'Failed to save tracklist' });
        }

        res.json({ success: true, message: 'Tracklist saved successfully' });
    } catch (error) {
        console.error('Error saving tracklist:', error);
        res.status(500).json({ error: 'Failed to save tracklist' });
    }
});

// Add single track
app.post('/api/tracklist/add', async (req, res) => {
    try {
        const { artist, song } = req.body;
        
        if (!artist || !song) {
            return res.status(400).json({ error: 'Artist and song are required' });
        }

        // Determine next position for this artist
        const { data: maxPosData } = await supabase
            .from('tracklists')
            .select('position')
            .eq('artist_name', artist)
            .order('position', { ascending: false, nullsFirst: false })
            .limit(1);

        const nextPosition = (maxPosData && maxPosData.length > 0 && maxPosData[0].position) ? (maxPosData[0].position + 1) : 1;

        const { data, error } = await supabase
            .from('tracklists')
            .insert({
                artist_name: artist,
                song_name: song,
                position: nextPosition
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'This song already exists for this artist' });
            }
            console.error('Error adding track:', error);
            return res.status(500).json({ error: 'Failed to add track' });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error adding track:', error);
        res.status(500).json({ error: 'Failed to add track' });
    }
});

// Delete single track
app.delete('/api/tracklist/delete', async (req, res) => {
    try {
        const { artist, song } = req.body;
        
        if (!artist || !song) {
            return res.status(400).json({ error: 'Artist and song are required' });
        }

        const { error } = await supabase
            .from('tracklists')
            .delete()
            .eq('artist_name', artist)
            .eq('song_name', song);

        if (error) {
            console.error('Error deleting track:', error);
            return res.status(500).json({ error: 'Failed to delete track' });
        }

        res.json({ success: true, message: 'Track deleted successfully' });
    } catch (error) {
        console.error('Error deleting track:', error);
        res.status(500).json({ error: 'Failed to delete track' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
    console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
});

