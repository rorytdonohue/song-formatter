# Deploying to Vercel

## Steps to Deploy:

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Add Vercel configuration"
   git push origin main
   ```

2. **Go to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository

3. **Configure Environment Variables**:
   - In Vercel dashboard, go to your project
   - Go to Settings → Environment Variables
   - Add: `ADMIN_PASSWORD` = `pg123` (or your preferred password)

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically detect the Node.js backend
   - Your app will be available at `https://your-project.vercel.app`

## Features:
- ✅ Frontend and backend both work
- ✅ File upload/download via admin panel
- ✅ Tracklist database (stored in browser localStorage)
- ✅ All formatting options (Table, Count, Station, Spingrid)
- ✅ QC dropdown for missing tracks

## Admin Access:
- Click the gear icon (⚙️) in top-right
- Enter admin password (default: `pg123`)
- Upload Excel files to get started

## Tracklist Management:
- Click the music note icon (🎵) in top-right
- Add artists and songs to build your database
- Export/Import tracklists as JSON files
