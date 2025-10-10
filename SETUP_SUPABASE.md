# Supabase Setup (15 minutes)

## Step 1: Create Supabase Project (3 min)

1. Go to https://supabase.com and sign up
2. Click **"New Project"**
3. Fill in project name, password, region
4. Click **"Create"** and wait 2 minutes

## Step 2: Setup Database (2 min)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy/paste ALL of `supabase-schema.sql` 
4. Click **"Run"**

## Step 3: Create Storage Bucket (2 min)

1. Go to **Storage** → **"Create bucket"**
2. Name: `excel-files`, Public: **OFF**
3. Click **"Create bucket"**
4. Click the bucket → **Policies** tab → **"New policy"**
5. Click **"Create policy from scratch"** and paste:

```sql
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'excel-files');

CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'excel-files');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'excel-files');
```

## Step 4: Get Your Keys (1 min)

1. Go to **Settings** → **API**
2. Copy these 3 things:
   - **Project URL** (like `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key

## Step 5: Configure Your Project (2 min)

Create a file called `.env` in your project folder:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=paste-your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-your-service-role-key-here
SUPABASE_BUCKET_NAME=excel-files
PORT=3000
```

## Step 6: Install & Run (3 min)

```bash
# Install dependencies
npm install

# Backup old server
mv server.js server-old.js

# Use new Supabase server
mv server-supabase.js server.js

# Start!
npm start
```

## Step 7: Test It (2 min)

1. Open http://localhost:3000
2. Open Tracklist Database (🎵 button)
3. Add a test song
4. Go to Supabase dashboard → **Table Editor** → **tracklists**
5. You should see your song there ✅

## Done! 🎉

Your app now saves everything to Supabase instead of local files.

## If Something Breaks

```bash
# Go back to old version
mv server.js server-supabase.js
mv server-old.js server.js
npm start
```

## Deploy to Production

Add these 4 environment variables in your hosting platform (Netlify/Vercel/Render):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET_NAME`

Then deploy normally.

