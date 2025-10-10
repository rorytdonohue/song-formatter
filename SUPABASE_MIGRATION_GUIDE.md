# 🚀 Supabase Migration Guide

This guide will help you migrate your Song Formatter application from local file storage to Supabase.

## Why Migrate to Supabase?

- **Persistent Storage**: No more losing files on serverless deployments
- **Real Database**: Replace JSON files with PostgreSQL
- **Better Auth**: Move away from hardcoded passwords
- **Scalability**: Handle multiple users and larger files
- **Free Tier**: Generous free tier for small projects

---

## Prerequisites

1. **Node.js** (v20+) installed
2. A **Supabase account** (free at [supabase.com](https://supabase.com))
3. Your existing Song Formatter project

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `song-formatter` (or your choice)
   - **Database Password**: Save this somewhere safe!
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes for setup

---

## Step 2: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it into the SQL Editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)

You should see success messages. This creates:
- `tracklists` table (stores artist-song relationships)
- `uploaded_files` table (tracks Excel file metadata)
- Necessary indexes and security policies
- Helper functions for JSON compatibility

---

## Step 3: Set Up Storage Bucket

1. In Supabase dashboard, go to **Storage** (left sidebar)
2. Click **"Create a new bucket"**
3. Fill in:
   - **Name**: `excel-files`
   - **Public bucket**: **Unchecked** (keep it private)
4. Click **"Create bucket"**

### Configure Storage Policies

1. Click on your new `excel-files` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**

**Policy 1: Allow authenticated uploads**
```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'excel-files');
```

**Policy 2: Allow authenticated users to update**
```sql
CREATE POLICY "Allow authenticated users to update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'excel-files');
```

**Policy 3: Allow authenticated users to delete**
```sql
CREATE POLICY "Allow authenticated users to delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'excel-files');
```

**Policy 4: Allow public to read (for downloading current file)**
```sql
CREATE POLICY "Allow public to read files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'excel-files');
```

---

## Step 4: Get Your API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. You'll see:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (safe to use in browser)
   - **service_role** key (⚠️ SECRET - only use server-side)

Keep these handy!

---

## Step 5: Configure Environment Variables

1. In your project root, create a file named `.env`:

```bash
cp env.template .env
```

2. Edit `.env` and fill in your Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-from-step-4
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-step-4

# Server Configuration
PORT=3000
NODE_ENV=development

# Storage
SUPABASE_BUCKET_NAME=excel-files
```

3. **⚠️ IMPORTANT**: Add `.env` to your `.gitignore`:

```bash
echo ".env" >> .gitignore
```

Never commit your `.env` file to git!

---

## Step 6: Install Dependencies

```bash
npm install
```

This will install the new `@supabase/supabase-js` package.

---

## Step 7: Switch to New Server

You have two options:

### Option A: Rename files (Recommended)

```bash
# Backup old server
mv server.js server-old.js

# Use new Supabase server
mv server-supabase.js server.js
```

### Option B: Change start script

Edit `package.json`:

```json
{
  "scripts": {
    "start": "node server-supabase.js",
    "dev": "NODE_ENV=development node server-supabase.js"
  }
}
```

---

## Step 8: Test Locally

1. Start the server:

```bash
npm start
```

2. Open browser to `http://localhost:3000`

3. Check console logs for:
   - `Supabase client initialized`
   - `Server running on port 3000`
   - `Supabase URL: https://xxxxx.supabase.co`

4. Test the features:
   - **Tracklist Database**: Add/remove songs (should save to Supabase)
   - **Admin Upload**: Upload an Excel file (should store in Supabase Storage)
   - **Find Matches**: Run a search to verify everything works

---

## Step 9: Verify in Supabase Dashboard

### Check Database
1. Go to **Table Editor** → **tracklists**
2. You should see your artist/song entries

### Check Storage
1. Go to **Storage** → **excel-files**
2. You should see uploaded Excel files in the `uploads/` folder

---

## Step 10: Deploy to Production

### For Netlify/Vercel

1. Add environment variables in your hosting dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET_NAME`

2. Deploy your code

### For Render/Railway

1. Add environment variables in the dashboard
2. Make sure to use `server.js` (or `server-supabase.js`) as your start command
3. Deploy

---

## Step 11: Migrate Existing Data (Optional)

If you have existing tracklist data in localStorage or JSON files:

### Export from Old System

1. Open your current app
2. Open browser console (F12)
3. Run:
```javascript
const data = localStorage.getItem('tracklistDatabase');
console.log(data);
// Copy this output
```

### Import to Supabase

1. Open new Supabase-powered app
2. Open Tracklist Database modal
3. Click "Import Tracklists"
4. Upload your exported JSON file

Alternatively, use the SQL Editor:

```sql
-- Example: Insert songs for an artist
INSERT INTO tracklists (artist_name, song_name) VALUES
('Taylor Swift', 'Shake It Off'),
('Taylor Swift', 'Blank Space'),
('Ed Sheeran', 'Shape of You');
```

---

## Troubleshooting

### "Supabase client not initialized"

**Problem**: Frontend can't connect to Supabase

**Solutions**:
1. Check that `/api/config` endpoint is working: `curl http://localhost:3000/api/config`
2. Verify `.env` file has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Check browser console for errors
4. Make sure you ran `npm install` after updating `package.json`

### "Row Level Security" errors

**Problem**: Can't read/write to database

**Solutions**:
1. Verify you ran the `supabase-schema.sql` script completely
2. Check **Authentication** → **Policies** in Supabase dashboard
3. Make sure policies are enabled for public read on tracklists
4. Try disabling RLS temporarily for testing:
   ```sql
   ALTER TABLE tracklists DISABLE ROW LEVEL SECURITY;
   ```
   ⚠️ Re-enable RLS after testing!

### "Storage bucket not found"

**Problem**: Can't upload files

**Solutions**:
1. Verify bucket name matches `.env` (`SUPABASE_BUCKET_NAME=excel-files`)
2. Check bucket exists in **Storage** dashboard
3. Verify storage policies are set up correctly
4. Check the bucket is created with correct permissions

### Files upload but can't be read

**Problem**: Upload succeeds but download fails

**Solutions**:
1. Check storage policies allow public read
2. Verify file path in database matches storage path
3. Check browser network tab for 403/404 errors
4. Try accessing file directly via Supabase Storage URL

### "CORS errors"

**Problem**: Browser blocks requests

**Solutions**:
1. Supabase automatically handles CORS for API requests
2. For custom domains, add them in **Settings** → **API** → **URL Configuration**
3. Make sure requests use correct headers

---

## Rolling Back

If something goes wrong and you need to go back:

```bash
# Restore old server
mv server-old.js server.js

# Or update package.json to use old server
# The app will fall back to localStorage automatically
```

The migration is designed with fallbacks, so your app should still work with localStorage if Supabase is unavailable.

---

## Architecture Comparison

### Before (Local Storage)
```
Browser → Express Server → Local Filesystem
                         → JSON files
                         → localStorage (backup)
```

### After (Supabase)
```
Browser → Express Server → Supabase Storage (files)
       ↘                → Supabase PostgreSQL (data)
         Supabase Client → Direct database access
```

---

## Security Notes

1. **Never commit `.env`** - Add it to `.gitignore`
2. **Service Role Key** - Only use on server-side (never in browser)
3. **Anon Key** - Safe for browser use (Row Level Security protects data)
4. **Password Auth** - The hardcoded `admin123` is still there. Consider:
   - Using Supabase Auth for real user management
   - Setting admin password as environment variable
   - Implementing proper authentication flow

---

## Next Steps (Optional Improvements)

1. **Replace hardcoded password** with Supabase Auth
2. **Add user management** - Multiple users with different permissions
3. **File history** - Keep track of all uploaded files, not just current
4. **Search history** - Save search queries and results
5. **Real-time updates** - Use Supabase Realtime for live collaboration
6. **Backup system** - Automatic exports of data

---

## Cost Estimates

Supabase Free Tier includes:
- **Database**: 500 MB storage
- **Storage**: 1 GB files
- **Bandwidth**: 2 GB/month
- **API Requests**: Unlimited

For this app, free tier should be sufficient unless you have:
- Thousands of songs in tracklist
- Hundreds of Excel files
- High traffic (100+ users/day)

---

## Support

If you run into issues:

1. Check Supabase logs: **Logs** → **API** in dashboard
2. Check browser console for errors
3. Check server logs (`npm start` output)
4. Review Supabase docs: [supabase.com/docs](https://supabase.com/docs)

---

## Summary

✅ Created Supabase project
✅ Ran SQL schema
✅ Created storage bucket
✅ Configured environment variables
✅ Installed dependencies
✅ Switched to new server
✅ Tested locally
✅ Verified in Supabase dashboard

Your Song Formatter is now powered by Supabase! 🎉

The app now has:
- ✨ Persistent file storage
- 🗄️ Real PostgreSQL database
- 🔒 Better security with RLS
- 📈 Room to scale
- 💾 Automatic backups (via Supabase)

