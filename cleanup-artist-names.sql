-- Clean up artist names in Supabase by removing " 2025" suffix
-- Run this in your Supabase SQL Editor

-- First, let's see what we're working with
SELECT DISTINCT artist_name 
FROM tracklists 
WHERE artist_name LIKE '% 2025'
ORDER BY artist_name;

-- Update artist names to remove " 2025" suffix
UPDATE tracklists 
SET artist_name = TRIM(REPLACE(artist_name, ' 2025', ''))
WHERE artist_name LIKE '% 2025';

-- Verify the changes
SELECT DISTINCT artist_name 
FROM tracklists 
WHERE artist_name LIKE '% 2025'
ORDER BY artist_name;

-- Show updated artist names (should be clean now)
SELECT DISTINCT artist_name 
FROM tracklists 
ORDER BY artist_name;
