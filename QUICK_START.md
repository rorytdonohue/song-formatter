# 🚀 Quick Start - Supabase Migration

**TL;DR**: Get your Song Formatter running on Supabase in 15 minutes.

## 1. Create Supabase Project (3 min)

1. Go to [supabase.com](https://supabase.com) → Sign up/Login
2. Click **"New Project"** → Fill in details → **"Create"**
3. Wait 2 minutes ☕

## 2. Run SQL Schema (1 min)

1. Supabase Dashboard → **SQL Editor** → **"New query"**
2. Copy-paste entire `supabase-schema.sql` file
3. Click **"Run"** ✅

## 3. Create Storage Bucket (2 min)

1. Dashboard → **Storage** → **"Create bucket"**
2. Name: `excel-files`, Public: **OFF**
3. **Policies** tab → Run these 4 queries:

```sql
-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'excel-files');

-- Allow authenticated updates
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'excel-files');

-- Allow authenticated deletes
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'excel-files');

-- Allow public reads
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'excel-files');
```

## 4. Get API Keys (1 min)

Dashboard → **Settings** → **API**

Copy these:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public** key
- **service_role** key (⚠️ SECRET)

## 5. Configure Project (2 min)

```bash
# Create .env file
cp env.template .env

# Edit .env with your keys
nano .env
```

Paste your keys:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_BUCKET_NAME=excel-files
PORT=3000
NODE_ENV=development
```

## 6. Install & Switch Server (2 min)

```bash
# Install Supabase client
npm install

# Backup old server
mv server.js server-old.js

# Use new server
mv server-supabase.js server.js

# Start!
npm start
```

## 7. Test (2 min)

Open `http://localhost:3000`

1. ✅ Check console: "Supabase client initialized"
2. ✅ Open Tracklist modal → Add a song
3. ✅ Check Supabase Dashboard → **Table Editor** → **tracklists** (should see your song)
4. ✅ Upload a test Excel file (Admin panel)
5. ✅ Check Supabase Dashboard → **Storage** → **excel-files** (should see file)

## 8. Deploy (5 min)

### Netlify/Vercel
1. Add environment variables in dashboard
2. Deploy

### Render/Railway  
1. Add environment variables
2. Deploy

---

## ⚠️ Troubleshooting

**Can't connect?**
```bash
# Test config endpoint
curl http://localhost:3000/api/config
```

**RLS errors?**
- Make sure you ran `supabase-schema.sql` completely
- Check policies in Supabase dashboard

**Storage errors?**
- Verify bucket name matches `.env`
- Check storage policies are created

---

## 🆘 Need Help?

See full guide: `SUPABASE_MIGRATION_GUIDE.md`

---

**You're done! 🎉**

Your app now has persistent storage, real database, and room to scale!

