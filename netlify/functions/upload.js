const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const ok = /xlsx|xls$/i.test(file.originalname);
        if (!ok) return cb(new Error('Only .xlsx/.xls files are allowed'));
        cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 }
});

exports.handler = async (event, context) => {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pg123';
        const password = event.headers['x-admin-password'] || event.headers['x-admin-password'];
        
        if (password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Parse multipart form data
        const boundary = event.headers['content-type']?.split('boundary=')[1];
        if (!boundary) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'No boundary found' })
            };
        }

        // For now, return success - you'll need to implement file storage
        // This is a simplified version - you'd need to store the file in Netlify's file system
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ ok: true, message: 'Upload endpoint ready - file storage needs implementation' })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
