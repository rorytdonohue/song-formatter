-- Safe cleanup of artist names - handles duplicates by merging songs
-- Run this in your Supabase SQL Editor

-- Step 1: See what duplicates we'll create
SELECT 
    TRIM(REPLACE(artist_name, ' 2025', '')) as clean_name,
    COUNT(DISTINCT artist_name) as original_count,
    COUNT(DISTINCT song_name) as total_songs
FROM tracklists 
WHERE artist_name LIKE '% 2025'
GROUP BY TRIM(REPLACE(artist_name, ' 2025', ''))
HAVING COUNT(DISTINCT artist_name) > 1;

-- Step 2: Create a temporary table with merged data
CREATE TEMP TABLE temp_merged_tracklists AS
SELECT 
    TRIM(REPLACE(artist_name, ' 2025', '')) as artist_name,
    song_name,
    MIN(created_at) as created_at,  -- Keep earliest timestamp
    MIN(position) as position       -- Keep earliest position
FROM tracklists
WHERE artist_name LIKE '% 2025'
GROUP BY TRIM(REPLACE(artist_name, ' 2025', '')), song_name;

-- Step 3: Delete the old entries with " 2025"
DELETE FROM tracklists 
WHERE artist_name LIKE '% 2025';

-- Step 4: Insert the merged clean entries (with conflict resolution)
INSERT INTO tracklists (artist_name, song_name, created_at, position)
SELECT artist_name, song_name, created_at, position
FROM temp_merged_tracklists
ON CONFLICT (artist_name, song_name) DO UPDATE
  SET created_at = LEAST(tracklists.created_at, EXCLUDED.created_at),
      position = LEAST(tracklists.position, EXCLUDED.position);

-- Step 5: Verify results
SELECT 
    artist_name,
    COUNT(*) as song_count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM tracklists 
WHERE artist_name IN (
    SELECT DISTINCT TRIM(REPLACE(artist_name, ' 2025', ''))
    FROM temp_merged_tracklists
)
GROUP BY artist_name
ORDER BY artist_name;

-- Clean up temp table
DROP TABLE temp_merged_tracklists;
