-- Supabase Schema for Song Formatter
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tracklist table (stores artist-song relationships)
CREATE TABLE IF NOT EXISTS tracklists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    artist_name TEXT NOT NULL,
    song_name TEXT NOT NULL,
    position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(artist_name, song_name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracklists_artist ON tracklists(artist_name);
CREATE INDEX IF NOT EXISTS idx_tracklists_song ON tracklists(song_name);

-- File metadata table (tracks uploaded Excel files)
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false
);

-- Ensure only one file is marked as current
CREATE OR REPLACE FUNCTION ensure_single_current_file()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = true THEN
        UPDATE uploaded_files 
        SET is_current = false 
        WHERE id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_current_file
    BEFORE INSERT OR UPDATE ON uploaded_files
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_current_file();

-- Row Level Security (RLS) Policies
ALTER TABLE tracklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tracklists (for the app to function)
CREATE POLICY "Allow public read access to tracklists"
    ON tracklists FOR SELECT
    USING (true);

-- Allow authenticated users to manage tracklists
CREATE POLICY "Allow authenticated users to insert tracklists"
    ON tracklists FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update tracklists"
    ON tracklists FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete tracklists"
    ON tracklists FOR DELETE
    USING (auth.role() = 'authenticated');

-- File policies - allow public read for current file
CREATE POLICY "Allow public read access to current file"
    ON uploaded_files FOR SELECT
    USING (is_current = true OR auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to upload files"
    ON uploaded_files FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update files"
    ON uploaded_files FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete files"
    ON uploaded_files FOR DELETE
    USING (auth.role() = 'authenticated');

-- Function to get all tracklists as JSON (for compatibility with existing code)
CREATE OR REPLACE FUNCTION get_tracklists_json()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_object_agg(artist_name, songs)
    INTO result
    FROM (
        SELECT 
            artist_name,
            jsonb_agg(song_name ORDER BY position NULLS LAST, created_at) as songs
        FROM tracklists
        GROUP BY artist_name
    ) grouped;
    
    RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Storage bucket for Excel files (run in SQL Editor or create via Dashboard)
-- Note: This needs to be created in the Supabase Dashboard under Storage
-- Bucket name: 'excel-files'
-- Public: false (requires authentication to upload)
-- Allowed MIME types: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel

-- Grant access to storage
-- You'll need to set up storage policies in the Supabase Dashboard:
-- 1. Allow authenticated users to upload
-- 2. Allow public to read the current file

