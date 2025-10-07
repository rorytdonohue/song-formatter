import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pg123';
const STORAGE_DIR = path.resolve('./storage');
const FILE_PATH = path.join(STORAGE_DIR, 'current.xlsx');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, STORAGE_DIR),
        filename: (req, file, cb) => cb(null, 'current.xlsx')
    }),
    fileFilter: (req, file, cb) => {
        const ok = /xlsx|xls$/i.test(file.originalname);
        if (!ok) return cb(new Error('Only .xlsx/.xls files are allowed'));
        cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 }
});

function requireAdmin(req, res, next) {
    const password = req.headers['x-admin-password'] || req.query.password || (req.body && req.body.password);
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/api/status', (req, res) => {
    const exists = fs.existsSync(FILE_PATH);
    let stats = null;
    if (exists) {
        const s = fs.statSync(FILE_PATH);
        stats = { size: s.size, mtime: s.mtimeMs };
    }
    res.json({ exists, stats });
});

app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
    return res.json({ ok: true });
});

app.delete('/api/file', requireAdmin, (req, res) => {
    if (fs.existsSync(FILE_PATH)) fs.unlinkSync(FILE_PATH);
    res.json({ ok: true });
});

app.get('/api/file', (req, res) => {
    if (!fs.existsSync(FILE_PATH)) return res.status(404).json({ error: 'No file' });
    res.setHeader('Content-Disposition', 'attachment; filename="current.xlsx"');
    res.sendFile(FILE_PATH);
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});


