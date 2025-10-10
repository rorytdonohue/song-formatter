const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from root

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'storage');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'current.xlsx');
  }
});

const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/status', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'storage', 'current.xlsx');
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      res.json({
        exists: true,
        filename: 'current.xlsx',
        stats: {
          size: stats.size,
          mtime: stats.mtime
        }
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking file status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({ 
    success: true, 
    message: 'File uploaded successfully',
    filename: req.file.originalname,
    size: req.file.size
  });
});

app.get('/api/file', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'storage', 'current.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="current.xlsx"');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/file', (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const filePath = path.join(__dirname, 'storage', 'current.xlsx');
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Tracklist API Routes
const tracklistPath = path.join(__dirname, 'storage', 'tracklist.json');

// Get tracklist database
app.get('/api/tracklist', (req, res) => {
  try {
    if (fs.existsSync(tracklistPath)) {
      const data = fs.readFileSync(tracklistPath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('Error reading tracklist:', error);
    res.status(500).json({ error: 'Failed to read tracklist' });
  }
});

// Save tracklist database
app.post('/api/tracklist', (req, res) => {
  try {
    const storageDir = path.join(__dirname, 'storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    fs.writeFileSync(tracklistPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'Tracklist saved successfully' });
  } catch (error) {
    console.error('Error saving tracklist:', error);
    res.status(500).json({ error: 'Failed to save tracklist' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});