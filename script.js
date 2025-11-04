// Global variables
let workbookRef = null; // keep workbook to scan all sheets
let headersBySheet = {}; // cache headers per sheet
let matches = []; // { station, artist, song }
let spinitronMatches = []; // Spinitron data matches
let onlineradioboxMatches = []; // Online Radio Box data matches
let kexpMatches = []; // KEXP API data matches
let tracklistDatabase = {}; // { artistName: [song1, song2, ...] }
let trackVariants = {}; // { "artist|variantSong": "parentSong" } - maps variant tracks to their parent
let currentResultFormat = 'table'; // Current display format
const FUZZY_THRESHOLD = 0.85; // 85% similarity for fuzzy matching

// Wisdom quotes
const wisdomQuotes = [
    { text: "If you have freedom, why not use it, right?", author: "Rory" },
    { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
    { text: "When the shoe is heating, it is already hot.", author: "Luke" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Only the best and the brightest are amongst my ranks.", author: "Adam" },
    { text: "By three methods we may learn wisdom: First, by reflection, which is noblest; Second, by imitation, which is easiest; and third by experience, which is the bitterest.", author: "Confucius" },
    { text: "The will to win, the desire to succeed, the urge to reach your full potential... these are the keys that will unlock the door to personal excellence.", author: "Confucius" },
    { text: "Choose a job you love, and you will never have to work a day in your life.", author: "Confucius" },
    { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "Confucius" },
    { text: "The superior man is modest in his speech, but exceeds in his actions.", author: "Confucius" },
    { text: "When you see a good person, think of becoming like them. When you see someone not so good, reflect on your own weak points.", author: "Confucius" },
    { text: "Everything has beauty, but not everyone sees it.", author: "Confucius" },
    { text: "The man who asks a question is a fool for a minute, the man who does not is a fool for life.", author: "Confucius" },
    { text: "To be able under all circumstances to practice five things constitutes perfect virtue; these five things are gravity, generosity of soul, sincerity, earnestness, and kindness.", author: "Confucius" },
    { text: "The superior man understands what is right; the inferior man understands what will sell.", author: "Confucius" },
    { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
    { text: "The way out is through the door. Why is it that no one will use this method?", author: "Confucius" },
    { text: "The music business is a cruel and shallow money trench, a long plastic hallway where thieves and pimps run free, and good men die like dogs. There's also a negative side.", author: "Hunter S. Thompson" }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeConfuciusQuotes();
});

// Wisdom quote functionality
function initializeConfuciusQuotes() {
    updateWisdomQuote();
    // Update every 2 minutes (120,000 ms)
    setInterval(updateWisdomQuote, 120000);
}

function updateWisdomQuote() {
    const quoteElement = document.getElementById('confuciusQuote');
    if (quoteElement) {
        const randomIndex = Math.floor(Math.random() * wisdomQuotes.length);
        const selectedQuote = wisdomQuotes[randomIndex];
        quoteElement.innerHTML = `"${selectedQuote.text}"<br><em>— ${selectedQuote.author}</em>`;
    }
}

function initializeApp() {
    // Admin status on load
    adminRefreshStatus();
    // Load tracklist database from localStorage
    loadTracklistDatabase();
    // Load track variants
    loadTrackVariants();
    // Display current tracklists
    displayTracklists();
}

// Clear Spinitron data from display for visual clarity
function clearSpinitronDisplay() {
    // Clear Spinitron data array
    spinitronMatches = [];
    
    // Clear Spinitron-specific display containers
    const csvSpingridContent = document.getElementById('csvSpingridContent');
    if (csvSpingridContent) csvSpingridContent.innerHTML = '<p style="text-align: center; color: #718096;">No data available.</p>';
    
    const csvResultsContent = document.getElementById('csvResultsContent');
    if (csvResultsContent) csvResultsContent.innerHTML = '';
    
    // Also clear from side-by-side comparison view if it exists
    const resultsDisplayEl = document.getElementById('resultsDisplay');
    if (resultsDisplayEl) {
        const csvSpingridContentInDisplay = resultsDisplayEl.querySelector('#csvSpingridContent');
        if (csvSpingridContentInDisplay) {
            csvSpingridContentInDisplay.innerHTML = '<p style="text-align: center; color: #718096;">No data available.</p>';
        }
    }
}

// Handle Spinitron upload for Spinitron formatter
function handleCsvUpload() {
    const fileInput = document.getElementById('csvFile');
    if (!fileInput) {
        console.error('CSV file input not found');
        alert('Error: File input not found. Please refresh the page.');
        return;
    }
    
    const file = fileInput.files[0];
    if (!file) {
        console.warn('No file selected');
        return;
    }
    
    console.log('File selected:', file.name, file.type, file.size);
    
    // Clear previous data when uploading a new file
    spinitronMatches = [];
    onlineradioboxMatches = [];
    matches = [];
    
    // Clear results display (but don't clear innerHTML - it contains the structure)
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
        // Don't clear innerHTML - it contains the table/spingrid structure we need
        // Just clear the content containers
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) tableBody.innerHTML = '';
        const stationBody = document.getElementById('stationResultsBody');
        if (stationBody) stationBody.innerHTML = '';
        const spingridBody = document.getElementById('spingridResultsBody');
        if (spingridBody) spingridBody.innerHTML = '';
    }
    
    // Clear Spinitron-specific display containers (already cleared spinitronMatches above,
    // but this ensures the display is visually cleared)
    const csvSpingridContent = document.getElementById('csvSpingridContent');
    if (csvSpingridContent) csvSpingridContent.innerHTML = '';
    const csvResultsContent = document.getElementById('csvResultsContent');
    if (csvResultsContent) csvResultsContent.innerHTML = '';
    
    // Reset file input value so same file can be uploaded again if needed
    // We'll do this after processing to avoid clearing before read completes
    
    const reader = new FileReader();
    
    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        alert('Error reading file: ' + (error.target?.error?.message || 'Unknown error'));
    };
    
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            console.log('File read, length:', csvText.length);
            console.log('First 200 chars:', csvText.substring(0, 200));
            
            const csvData = parseCSV(csvText);
            console.log('Parsed CSV data:', csvData.length, 'rows');
            
            if (csvData.length === 0) {
                alert('Spinitron file appears to be empty or could not be parsed. Please check the file format.');
                return;
            }
            
            // Process the Spinitron data and show results
            processCsvData(csvData);
            
            // Reset file input after successful processing
            // This allows uploading the same file again if needed
            fileInput.value = '';
            
        } catch (error) {
            console.error('Error parsing Spinitron:', error);
            console.error('Error stack:', error.stack);
            alert('Error reading Spinitron file: ' + error.message + '\n\nPlease make sure it\'s a valid CSV file.');
            
            // Reset file input on error too
            fileInput.value = '';
        }
    };
    
    try {
    reader.readAsText(file);
    } catch (error) {
        console.error('Error starting file read:', error);
        alert('Error starting file upload: ' + error.message);
    }
}

// Parse CSV text into array of objects (handles quoted fields properly)
function parseCSV(csvText) {
    if (!csvText || !csvText.trim()) {
        console.warn('parseCSV: Empty or whitespace-only input');
        return [];
    }
    
    const lines = [];
    let currentLine = '';
    let inQuotes = false;
    
    // Handle quoted fields that may contain newlines
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentLine += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                currentLine += char;
            }
        } else if (char === '\n' || (char === '\r' && nextChar !== '\n')) {
            if (inQuotes) {
                // Newline inside quoted field
                currentLine += char;
            } else {
                // End of line
                if (currentLine.trim()) {
                    lines.push(currentLine);
                }
                currentLine = '';
            }
        } else if (char !== '\r') {
            // Skip standalone \r (will be part of \r\n which we handle above)
            currentLine += char;
        }
    }
    
    // Add last line if exists
    if (currentLine.trim()) {
        lines.push(currentLine);
    }
    
    if (lines.length === 0) {
        console.warn('parseCSV: No lines found after parsing');
        return [];
    }
    
    console.log('parseCSV: Parsed', lines.length, 'lines');
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    if (headers.length === 0) {
        console.warn('parseCSV: No headers found');
        return [];
    }
    
    console.log('parseCSV: Headers:', headers);
    
    const data = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length > 0) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
    }
    
    console.log('parseCSV: Parsed', data.length, 'data rows');
    return data;
}

// Parse a single CSV line respecting quoted fields
function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentValue += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator (only outside quotes)
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // Add last value
    values.push(currentValue.trim());
    
    return values;
}

// Process Spinitron data and display results
function processCsvData(csvData) {
    console.log('processCsvData: Starting with', csvData.length, 'rows');
    
    // Log available columns from first row
    if (csvData.length > 0) {
        console.log('processCsvData: Available columns:', Object.keys(csvData[0]));
        console.log('processCsvData: First row sample:', csvData[0]);
    }
    
    // Convert Spinitron data to matches format
    matches = [];
    
    csvData.forEach((row, index) => {
        // Try to extract station, artist, and song from various possible column names
        // Check all column names case-insensitively
        const rowKeys = Object.keys(row);
        let station = 'Unknown';
        let artist = '';
        let song = '';
        
        // Find station column (case-insensitive)
        const stationKey = rowKeys.find(key => 
            /station|show|program|playlist/i.test(key)
        );
        if (stationKey) {
            station = row[stationKey] || 'Unknown';
        }
        
        // Find artist column (case-insensitive)
        const artistKey = rowKeys.find(key => 
            /artist|performer|singer|band/i.test(key)
        );
        if (artistKey) {
            artist = row[artistKey] || '';
        }
        
        // Find song column (case-insensitive)
        const songKey = rowKeys.find(key => 
            /song|title|track|name/i.test(key)
        );
        if (songKey) {
            song = row[songKey] || '';
        }
        
        // Fallback: try common variations
        if (!station || station === 'Unknown') {
            station = row['Station'] || row['station'] || row['Show'] || row['show'] || 'Unknown';
        }
        if (!artist) {
            artist = row['Artist'] || row['artist'] || row['Performer'] || row['performer'] || '';
        }
        if (!song) {
            song = row['Song'] || row['song'] || row['Title'] || row['title'] || '';
        }
        
        if (song && song.trim()) {
            // If no artist column, we'll need to prompt user for artist name
            if (artist && artist.trim()) {
                matches.push({ station, artist, song });
            } else {
                // Store without artist for now - we'll handle this case
                matches.push({ station, artist: '', song });
            }
        } else if (index === 0) {
            // Log warning on first row if we can't find song
            console.warn('processCsvData: Could not find song column in row', index, 'Available keys:', rowKeys);
        }
    });
    
    console.log('processCsvData: Extracted', matches.length, 'matches');
    
    if (matches.length === 0) {
        const availableColumns = csvData.length > 0 ? Object.keys(csvData[0]).join(', ') : 'none';
        alert(`No valid spin data found in Spinitron file.\n\nAvailable columns: ${availableColumns}\n\nPlease check that your Spinitron file has columns for Station/Show and Song/Title.`);
        return;
    }
    
    // Check if we have artist data or need to auto-detect
    const hasArtistData = matches.some(match => match.artist);
    
    if (!hasArtistData) {
        // No artist column - try to auto-detect artist from songs
        const detectedArtist = detectArtistFromSongs(matches);
        
        if (detectedArtist) {
            // Add detected artist name to all matches
            matches = matches.map(match => ({ ...match, artist: detectedArtist }));
        } else {
            // Fallback to manual input if auto-detection fails
            const artistName = prompt('Could not auto-detect artist from songs. Please enter the artist name for these songs:');
            if (!artistName || artistName.trim() === '') {
                        alert('Artist name is required to process the Spinitron data.');
                return;
            }
            
            // Add artist name to all matches
            matches = matches.map(match => ({ ...match, artist: artistName.trim() }));
        }
    }
    
    // Find artists from Spinitron that match tracklist database
    const foundArtists = findArtistsInCsvData(matches);
    
    if (foundArtists.length === 0) {
        // No artists found in tracklist database - offer fallback option
        const proceedWithoutTracklist = confirm(
            'No artists from the Spinitron data match the tracklist database.\n\n' +
            'Would you like to proceed anyway? This will show the raw Spinitron data without spingrid formatting.\n\n' +
            'Click OK to continue with basic analysis, or Cancel to add artists to the tracklist database first.'
        );
        
        if (!proceedWithoutTracklist) {
            return;
        }
        
        // Proceed with fallback mode
        processCsvDataFallback(matches);
        return;
    }
    
    // Store Spinitron data separately
    spinitronMatches = [...matches];
    
    console.log('processCsvData: Showing results display');
    
    // Show the results display - make sure we restore the HTML structure first
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (!resultsDisplay) {
        console.error('processCsvData: resultsDisplay element not found!');
        alert('Error: Results display element not found. Please refresh the page.');
        return;
    }
    
    // Restore results display structure if it was cleared
    if (!resultsDisplay.innerHTML || resultsDisplay.innerHTML.trim() === '') {
        console.warn('processCsvData: Results display was cleared, restoring structure');
        // The HTML structure should be in index.html, but if innerHTML was cleared,
        // we need to make sure the display still works
        // Actually, since we're setting innerHTML to '' in handleCsvUpload, 
        // we shouldn't be clearing it - let's just not clear it
    }
    
    resultsDisplay.style.display = 'block';
    
    // Keep the load section visible so user can upload a new file to replace this one
    // Don't hide it - just keep it available for new uploads
    
    // Set up the artist names input with found artists
    setupCsvArtistInput(foundArtists);
    
    // Add Find Matches button for Online Radio Box data
    addFindMatchesButton();
    
    console.log('processCsvData: Calling displayResults with', matches.length, 'matches');
    
    // Display Spinitron results in current format
    displayResults(matches);
    
    // Update summary
    const summaryEl = document.getElementById('summary');
    if (summaryEl) {
        summaryEl.textContent = `${matches.length} spins loaded from Spinitron file. Found ${foundArtists.length} artists: ${foundArtists.join(', ')}. Click "Find Matches" to search Online Radio Box file.`;
    }
    
    console.log('processCsvData: Completed successfully');
}

// Find artists from Spinitron data that match tracklist database
function findArtistsInCsvData(matches) {
    const foundArtists = new Set();
    
    matches.forEach(match => {
        const spinitronArtist = match.artist;
        
        // Check if this artist matches any in the tracklist database
        const tracklistArtists = Object.keys(tracklistDatabase);
        tracklistArtists.forEach(tracklistArtist => {
            // Use fuzzy matching to see if Spinitron artist matches tracklist artist
            const similarity = similarityRatio(spinitronArtist, tracklistArtist);
            if (similarity >= FUZZY_THRESHOLD) {
                foundArtists.add(tracklistArtist);
            }
        });
    });
    
    return Array.from(foundArtists);
}

// Set up the artist names input with found artists
function setupCsvArtistInput(foundArtists) {
    const artistNamesTextarea = document.getElementById('artistNames');
    if (artistNamesTextarea) {
        artistNamesTextarea.value = foundArtists.join('\n');
    }
}

// Auto-detect artist from Spinitron songs by matching against tracklist database
function detectArtistFromSongs(matches) {
    const spinitronSongs = matches.map(match => match.song);
    const tracklistArtists = Object.keys(tracklistDatabase);
    
    // Score each artist based on how many of their songs appear in the Spinitron data
    const artistScores = {};
    
    tracklistArtists.forEach(artist => {
        const artistSongs = tracklistDatabase[artist];
        let matchCount = 0;
        
        artistSongs.forEach(tracklistSong => {
            // Check if this tracklist song matches any Spinitron song (fuzzy matching)
            spinitronSongs.forEach(spinitronSong => {
                const similarity = similarityRatio(tracklistSong, spinitronSong);
                if (similarity >= FUZZY_THRESHOLD) {
                    matchCount++;
                }
            });
        });
        
        if (matchCount > 0) {
            artistScores[artist] = matchCount;
        }
    });
    
    // Find the artist with the highest score
    let bestArtist = null;
    let bestScore = 0;
    
    Object.entries(artistScores).forEach(([artist, score]) => {
        if (score > bestScore) {
            bestScore = score;
            bestArtist = artist;
        }
    });
    
    // Only return if we have a clear winner (at least 2 matches or 50% of songs)
    const totalSongs = spinitronSongs.length;
    if (bestScore >= 2 || (bestScore / totalSongs) >= 0.5) {
        return bestArtist;
    }
    
    return null;
}

// Add Find Matches button for Online Radio Box data
function addFindMatchesButton() {
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        const findMatchesSection = document.createElement('div');
        findMatchesSection.className = 'find-matches-section';
        findMatchesSection.innerHTML = `
            <div class="find-matches-header">
                <h4>Find Matches in Online Radio Box File</h4>
                <p>Search the main Online Radio Box database for the same artist</p>
            </div>
            <div class="find-matches-controls">
                <button class="process-btn" onclick="findExcelMatches()">Find Matches in Online Radio Box</button>
            </div>
        `;
        resultsDisplay.appendChild(findMatchesSection);
    }
}

// Find matches in Online Radio Box file for the same artist
async function findExcelMatches() {
    if (!workbookRef) {
        alert('Online Radio Box file not loaded. Please load the Online Radio Box file first.');
        return;
    }
    
    // Get the artist from Spinitron data
    const spinitronArtist = spinitronMatches.length > 0 ? spinitronMatches[0].artist : '';
    if (!spinitronArtist) {
        alert('No artist found in Spinitron data.');
        return;
    }
    
    // Run the Online Radio Box search without touching the main artist input
    await findMatchesForExcel(spinitronArtist);
    
    // Show both results within the Spinitron section
    showSpinitronWithBothResults();
}

// Modified findMatches function for Online Radio Box data
async function findMatchesForExcel(artistName) {
    if (!workbookRef) {
        alert('Please load a file first.');
        return;
    }
    
    // Use the provided artist name instead of reading from input
    const artistList = [artistName];
    const artistSet = new Set(artistList.map(a => a.toLowerCase()))
    if (artistSet.size === 0) {
        alert('No artist name provided.');
        return;
    }
    
    onlineradioboxMatches = [];
    const summary = { rowsScanned: 0, sheetsScanned: 0 };
    const progressEl = document.getElementById('progress');
    progressEl.textContent = 'Searching Online Radio Box file...';
    
    const sheetNames = workbookRef.SheetNames;
    for (let s = 0; s < sheetNames.length; s++) {
        const sheetName = sheetNames[s];
        progressEl.textContent = `Scanning sheet ${s + 1}/${sheetNames.length}: ${sheetName}...`;
        // Yield to UI before heavy work
        await new Promise(r => setTimeout(r, 0));
        
        const ws = workbookRef.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) continue;
        summary.sheetsScanned++;
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            summary.rowsScanned++;
            
            // Extract artist/song from up to first 5 columns robustly
            const extracted = extractArtistSongFromRow(row, artistList, artistSet);
            let artist = extracted.artist;
            let song = extracted.song;
            
            if (!artist || !song) continue;
            if (artistSet.has(artist.toLowerCase())) {
                // Check if song is in tracklist database (if available)
                const hasTracklist = Object.keys(tracklistDatabase).length > 0;
                if (hasTracklist) {
                    const tlMatch = matchTracklistFuzzy(artist, song);
                    if (tlMatch.ok) {
                        // Canonicalize artist and song to database values so downstream lookups align
                        onlineradioboxMatches.push({ station: sheetName, artist: tlMatch.artist, song: tlMatch.song });
                    } else {
                        // Artist not in tracklist database - still return the spin
                        onlineradioboxMatches.push({ station: sheetName, artist, song });
                    }
                } else {
                    // No tracklist database - return all results
                    onlineradioboxMatches.push({ station: sheetName, artist, song });
                }
            }
            // Yield occasionally on large rows to keep UI responsive
            if (i % 1000 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }
    
    progressEl.textContent = '';
}

// Calculate date range: previous Thursday to last Thursday (one week)
function getKexpDateRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get last Thursday (most recent Thursday, including today if it's Thursday)
    const lastThursday = new Date(today);
    const dayOfWeek = lastThursday.getDay(); // 0 = Sunday, 4 = Thursday
    // If today is Thursday (4), we want today. Otherwise, go back to the most recent Thursday
    let daysToSubtract = 0;
    if (dayOfWeek < 4) {
        // Before Thursday: go back to previous week's Thursday
        daysToSubtract = dayOfWeek + 3; // e.g., Monday (1) -> back 4 days to Thursday
    } else if (dayOfWeek > 4) {
        // After Thursday: go back to this week's Thursday
        daysToSubtract = dayOfWeek - 4; // e.g., Saturday (6) -> back 2 days to Thursday
    }
    // If dayOfWeek === 4, it's Thursday, so daysToSubtract = 0 (use today)
    lastThursday.setDate(today.getDate() - daysToSubtract);
    
    // Get previous Thursday (one week before last Thursday)
    const previousThursday = new Date(lastThursday);
    previousThursday.setDate(lastThursday.getDate() - 7);
    
    // Format as ISO strings for API (YYYY-MM-DD)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    return {
        start: formatDate(previousThursday),
        end: formatDate(lastThursday)
    };
}

// Fetch KEXP API data for one or more artists (helper function)
// Returns array of matches with source: 'kexp' flag
async function fetchKexpDataForArtists(artistList, progressCallback) {
    const kexpResults = [];
    
    // Get date range: previous Thursday to last Thursday
    const dateRange = getKexpDateRange();
    
    // Cache for show names and DJ info to avoid repeated API calls
    const showCache = {};
    
    for (const artistName of artistList) {
        if (progressCallback) {
            progressCallback(`Fetching KEXP data for ${artistName}...`);
        }
        
        // Fetch results for this artist within date range
        // Try with date parameters first, but filter client-side as well in case API doesn't support them
        let nextUrl = `https://api.kexp.org/v2/plays/?artist=${encodeURIComponent(artistName)}&limit=100`;
        let totalFetched = 0;
        let hasMorePages = true;
        
        while (hasMorePages && nextUrl) {
            if (progressCallback) {
                progressCallback(`Fetching KEXP page ${Math.floor(totalFetched / 100) + 1} for ${artistName}... (${totalFetched} plays)`);
            }
            
            try {
                const response = await fetch(nextUrl);
                if (!response.ok) {
                    console.warn(`KEXP API error for ${artistName}: ${response.status}`);
                    break;
                }
                
                const data = await response.json();
                
                // Process each play result
                for (const play of data.results) {
                    // Only include trackplay entries (skip airbreaks)
                    if (play.play_type !== 'trackplay' || !play.artist || !play.song) {
                        continue;
                    }
                    
                    // Filter by date range (double-check client-side)
                    if (play.airdate) {
                        const playDate = new Date(play.airdate);
                        const startDate = new Date(dateRange.start);
                        const endDate = new Date(dateRange.end);
                        endDate.setHours(23, 59, 59, 999); // End of day
                        
                        if (playDate < startDate || playDate > endDate) {
                            continue; // Skip plays outside date range
                        }
                    }
                    
                    // Client-side filtering: only include if artist matches (case-insensitive, fuzzy)
                    const playArtistLower = play.artist.toLowerCase();
                    const searchArtistLower = artistName.toLowerCase();
                    if (!playArtistLower.includes(searchArtistLower) && 
                        similarityRatio(playArtistLower, searchArtistLower) < FUZZY_THRESHOLD) {
                        // Try fuzzy match with normalized names
                        const normalizedPlayArtist = normalizeText(play.artist);
                        const normalizedSearchArtist = normalizeText(artistName);
                        if (similarityRatio(normalizedPlayArtist, normalizedSearchArtist) < FUZZY_THRESHOLD) {
                            continue; // Skip this play - artist doesn't match
                        }
                    }
                    
                    // Get DJ name and show name from show API
                    let djName = '';
                    let stationName = '';
                    
                    // Fetch show details if not cached
                    if (play.show_uri && !showCache[play.show]) {
                        try {
                            const showResponse = await fetch(play.show_uri);
                            if (showResponse.ok) {
                                const showData = await showResponse.json();
                                
                                // Get show/program name
                                if (showData.program && showData.program.name) {
                                    stationName = showData.program.name;
                                } else if (showData.program_name) {
                                    stationName = showData.program_name;
                                } else if (showData.name) {
                                    stationName = showData.name;
                                }
                                
                                // Get DJ/host name - try multiple possible fields
                                if (showData.hosts && Array.isArray(showData.hosts) && showData.hosts.length > 0) {
                                    djName = showData.hosts.map(h => {
                                        if (typeof h === 'string') return h;
                                        if (h && typeof h === 'object') return h.name || h.display_name || JSON.stringify(h);
                                        return '';
                                    }).filter(h => h).join(', ');
                                } else if (showData.host) {
                                    if (typeof showData.host === 'string') {
                                        djName = showData.host;
                                    } else if (showData.host && typeof showData.host === 'object') {
                                        djName = showData.host.name || showData.host.display_name || JSON.stringify(showData.host);
                                    }
                                } else if (showData.dj) {
                                    if (typeof showData.dj === 'string') {
                                        djName = showData.dj;
                                    } else if (showData.dj && typeof showData.dj === 'object') {
                                        djName = showData.dj.name || showData.dj.display_name || JSON.stringify(showData.dj);
                                    }
                                } else if (showData.dj_name) {
                                    djName = showData.dj_name;
                                }
                                
                                showCache[play.show] = { name: stationName, dj: djName };
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch show ${play.show}:`, err);
                            showCache[play.show] = { name: '', dj: '' }; // Cache empty to avoid repeated calls
                        }
                    } else if (showCache[play.show]) {
                        stationName = showCache[play.show].name;
                        djName = showCache[play.show].dj;
                    }
                    
                    // Format station name - prioritize DJ name in brackets
                    let finalStationName = '';
                    if (djName) {
                        // If we have both show name and DJ, show both
                        if (stationName) {
                            finalStationName = `${stationName} [${djName}]`;
                        } else {
                            // If only DJ name, just show it in brackets
                            finalStationName = `[${djName}]`;
                        }
                    } else if (stationName) {
                        // If only show name, use that
                        finalStationName = stationName;
                    } else {
                        // Fallback to show ID
                        finalStationName = `KEXP Show ${play.show}`;
                    }
                    
                    // Check if song is in tracklist database (if available)
                    const hasTracklist = Object.keys(tracklistDatabase).length > 0;
                    if (hasTracklist) {
                        const tlMatch = matchTracklistFuzzy(play.artist, play.song);
                        if (tlMatch.ok) {
                            // Canonicalize artist and song to database values
                            kexpResults.push({ 
                                station: finalStationName, 
                                artist: tlMatch.artist, 
                                song: tlMatch.song,
                                source: 'kexp'
                            });
                        } else {
                            // Artist not in tracklist database - still return the spin
                            kexpResults.push({ 
                                station: finalStationName, 
                                artist: play.artist, 
                                song: play.song,
                                source: 'kexp'
                            });
                        }
                    } else {
                        // No tracklist database - return all results
                        kexpResults.push({ 
                            station: finalStationName, 
                            artist: play.artist, 
                            song: play.song,
                            source: 'kexp'
                        });
                    }
                }
                
                totalFetched += data.results.length;
                
                // Check if we've gone outside our date range (API returns most recent first)
                // If all results in this page are before our start date, stop paginating
                let allBeforeStartDate = true;
                for (const play of data.results) {
                    if (play.airdate) {
                        const playDate = new Date(play.airdate);
                        const startDate = new Date(dateRange.start);
                        if (playDate >= startDate) {
                            allBeforeStartDate = false;
                            break;
                        }
                    }
                }
                
                // If all results are before our date range, stop paginating
                if (allBeforeStartDate && data.results.length > 0) {
                    hasMorePages = false;
                    break;
                }
                
                // Check if there are more pages
                if (data.next && data.results.length > 0 && !allBeforeStartDate) {
                    nextUrl = data.next;
                } else {
                    hasMorePages = false;
                }
                
                // Small delay to avoid rate limiting
                if (nextUrl && hasMorePages) {
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (error) {
                console.error(`Error fetching KEXP data for ${artistName}:`, error);
                break;
            }
        }
    }
    
    return kexpResults;
}

// Fetch KEXP API data for an artist (UI function)
async function fetchKexpData() {
    const artistInput = document.getElementById('kexpArtistInput');
    const progressEl = document.getElementById('kexpProgress');
    
    if (!artistInput || !artistInput.value.trim()) {
        alert('Please enter an artist name.');
        return;
    }
    
    const artistName = artistInput.value.trim();
    
    // Clear previous KEXP data
    kexpMatches = [];
    
    // Clear previous display
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
    }
    
    progressEl.textContent = 'Fetching data from KEXP API...';
    
    try {
        const results = await fetchKexpDataForArtists([artistName], (msg) => {
            progressEl.textContent = msg;
        });
        
        kexpMatches = results;
        
        progressEl.textContent = `Found ${kexpMatches.length} plays from KEXP API`;
        
        if (kexpMatches.length === 0) {
            alert(`No plays found for "${artistName}" on KEXP.`);
            return;
        }
        
        // Display results in the same format as other data sources
        displayKexpResults();
        
    } catch (error) {
        console.error('Error fetching KEXP data:', error);
        progressEl.textContent = '';
        alert(`Error fetching KEXP data: ${error.message}`);
    }
}

// Display KEXP results
function displayKexpResults() {
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (!resultsDisplay) return;
    
    resultsDisplay.innerHTML = `
        <div class="results-header">
            <h3>KEXP API Results</h3>
            <div class="format-toggles">
                <button class="format-btn active" onclick="setKexpResultFormat('table')" id="kexpTableFormatBtn">Table View</button>
                <button class="format-btn" onclick="setKexpResultFormat('station')" id="kexpStationFormatBtn">Station Format</button>
                <button class="format-btn" onclick="setKexpResultFormat('spingrid')" id="kexpSpingridFormatBtn">Spingrid</button>
            </div>
        </div>
        
        <!-- Table Format -->
        <div id="kexpTableFormat" class="result-format">
            <div class="results-table-container">
                <table id="kexpResultsTable" class="results-table">
                    <thead>
                        <tr>
                            <th>station</th>
                            <th>artist</th>
                            <th>song</th>
                            <th>actions</th>
                        </tr>
                    </thead>
                    <tbody id="kexpResultsTableBody">
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Station Format -->
        <div id="kexpStationFormat" class="result-format" style="display: none;">
            <div class="results-text-container">
                <div id="kexpStationResultsBody"></div>
            </div>
        </div>
        
        <!-- Spingrid Format -->
        <div id="kexpSpingridFormat" class="result-format" style="display: none;">
            <div class="format-actions">
                <button class="download-btn" onclick="copyKexpSpingridForExcel()">copy for excel</button>
            </div>
            <div class="results-text-container">
                <div id="kexpSpingridResultsBody"></div>
            </div>
        </div>
    `;
    
    // Show in table format initially
    setKexpResultFormat('table');
}

// Set KEXP result format and update display
function setKexpResultFormat(format) {
    // Update button states
    document.querySelectorAll('#kexpTableFormatBtn, #kexpStationFormatBtn, #kexpSpingridFormatBtn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`kexp${format.charAt(0).toUpperCase() + format.slice(1)}FormatBtn`).classList.add('active');
    
    // Hide all formats
    document.getElementById('kexpTableFormat').style.display = 'none';
    document.getElementById('kexpStationFormat').style.display = 'none';
    document.getElementById('kexpSpingridFormat').style.display = 'none';
    
    // Show selected format
    document.getElementById(`kexp${format.charAt(0).toUpperCase() + format.slice(1)}Format`).style.display = 'block';
    
    // Display in selected format
    switch (format) {
        case 'table':
            displayKexpTableFormat();
            break;
        case 'station':
            displayKexpStationFormat();
            break;
        case 'spingrid':
            displayKexpSpingridFormat();
            break;
    }
    
    // Show results display
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.style.display = 'block';
    }
}

// Display KEXP results in table format
function displayKexpTableFormat() {
    const tableBody = document.getElementById('kexpResultsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    kexpMatches.forEach((match, index) => {
        const row = document.createElement('tr');
        
        // Highlight all KEXP results in green (they're all from KEXP in this view)
        row.style.backgroundColor = '#e6f7e6'; // Light green background
        
        // Check if this track is a variant (case-insensitive matching)
        const matchArtistLower = match.artist.toLowerCase();
        const normalizedMatchSong = normalizeText(match.song);
        let variantParent = null;
        for (const [key, parent] of Object.entries(trackVariants)) {
            const [variantArtist, variantSong] = key.split('|');
            const normalizedVariantSong = normalizeText(variantSong);
            if (variantArtist.toLowerCase() === matchArtistLower && normalizedVariantSong === normalizedMatchSong) {
                variantParent = parent;
                break;
            }
        }
        const variantIndicator = variantParent ? ` <span style="color: #718096; font-size: 0.85em;">(variant of ${escapeHtml(variantParent)})</span>` : '';
        
        // Check if this track is in the tracklist database (recognized in spingrid)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === match.artist.toLowerCase()
        );
        const isInTracklist = tracklistArtist && tracklistDatabase[tracklistArtist] && 
            isSongInTracklistFuzzy(tracklistArtist, match.song);
        
        // Only show "make variant" button if track is NOT in tracklist database
        let actionContent = '';
        if (isInTracklist) {
            if (variantParent) {
                actionContent = `<span style="color: #718096; font-size: 0.85em;">in tracklist • variant of ${escapeHtml(variantParent)}</span>`;
            } else {
                actionContent = '<span style="color: #718096; font-size: 0.85em;">in tracklist</span>';
            }
        } else {
            actionContent = `
                <button class="variant-btn" onclick="openVariantModal('${escapeHtml(match.artist)}', '${escapeHtml(match.song)}')" title="Make this track a variant of another track">
                    make variant
                </button>
            `;
        }
        
        row.innerHTML = `
            <td>${escapeHtml(match.station)}</td>
            <td>${escapeHtml(match.artist)}</td>
            <td>${escapeHtml(match.song)}${variantIndicator}</td>
            <td>${actionContent}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Display KEXP results in station format
function displayKexpStationFormat() {
    const stationResultsBody = document.getElementById('kexpStationResultsBody');
    if (!stationResultsBody) return;
    
    // Group by artist first, then by station and song
    const artistGroups = {};
    kexpMatches.forEach(match => {
        if (!artistGroups[match.artist]) {
            artistGroups[match.artist] = {};
        }
        if (!artistGroups[match.artist][match.station]) {
            artistGroups[match.artist][match.station] = {};
        }
        if (!artistGroups[match.artist][match.station][match.song]) {
            artistGroups[match.artist][match.station][match.song] = 0;
        }
        artistGroups[match.artist][match.station][match.song]++;
    });
    
    let html = '';
    Object.keys(artistGroups).sort().forEach(artistName => {
        html += `<div class="artist-section">`;
        html += `<div class="artist-header">${escapeHtml(artistName)}</div>`;
        
        const stations = artistGroups[artistName];
        Object.keys(stations).sort().forEach(stationName => {
            const songs = stations[stationName];
            const songEntries = Object.entries(songs).map(([songName, count]) => {
                return count > 1 ? `"${escapeHtml(songName)}" (${count})` : `"${escapeHtml(songName)}"`;
            });
            
            html += `<div class="station-entry">${escapeHtml(stationName)} Spun - ${songEntries.join(', ')}</div>`;
        });
        
        html += `</div>`;
    });
    
    stationResultsBody.innerHTML = html;
}

// Display KEXP results in spingrid format
function displayKexpSpingridFormat() {
    const spingridResultsBody = document.getElementById('kexpSpingridResultsBody');
    if (!spingridResultsBody) return;
    
    // Get the artist from KEXP matches
    const artistList = kexpMatches.length > 0 ? [kexpMatches[0].artist] : [];
    
    if (artistList.length === 0) {
        spingridResultsBody.innerHTML = '<p style="text-align: center; color: #718096;">No artists found.</p>';
        return;
    }
    
    // Temporarily set artist input so displaySpingridFormat can read it
    const artistInput = document.getElementById('artistNames');
    const originalArtistValue = artistInput ? artistInput.value : '';
    
    if (artistInput) {
        artistInput.value = artistList.join(', ');
    }
    
    try {
        // Use the existing displaySpingridFormat function with KEXP matches
        displaySpingridFormat(kexpMatches, 'kexpSpingridResultsBody');
    } finally {
        // Restore original artist value
        if (artistInput) {
            artistInput.value = originalArtistValue;
        }
    }
}

// Copy KEXP spingrid for Excel
function copyKexpSpingridForExcel() {
    // Get the artist from KEXP matches
    const artistList = kexpMatches.length > 0 ? [kexpMatches[0].artist] : [];
    
    if (artistList.length === 0) {
        alert('No KEXP data to copy.');
        return;
    }
    
    // Temporarily set artist input and matches, then call the function
    const artistInput = document.getElementById('artistNames');
    const originalArtistValue = artistInput ? artistInput.value : '';
    const originalMatches = matches;
    
    if (artistInput) {
        artistInput.value = artistList.join(', ');
    }
    matches = kexpMatches;
    
    try {
        copySpingridForExcel();
    } finally {
        // Restore original values
        if (artistInput) {
            artistInput.value = originalArtistValue;
        }
        matches = originalMatches;
    }
}

// Show side-by-side spingrids
function showSideBySideSpingrids() {
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = `
        <div class="results-header">
            <h3>Spingrid Comparison</h3>
            <div class="format-toggles">
                <button class="format-btn active" onclick="showSideBySideSpingrids()" id="comparisonFormatBtn">Side by Side</button>
                <button class="format-btn" onclick="showMergedSpingrid()" id="mergedFormatBtn">Merged</button>
            </div>
        </div>
        
        <div class="side-by-side-container">
            <div class="spingrid-panel">
                <h4>Spinitron Data (${spinitronMatches.length} spins)</h4>
                <div class="spingrid-content" id="csvSpingridContent"></div>
            </div>
            <div class="spingrid-panel">
                <h4>Online Radio Box Data (${onlineradioboxMatches.length} spins)</h4>
                <div class="spingrid-content" id="excelSpingridContent"></div>
            </div>
        </div>
        
        <div class="merge-controls">
            <button class="process-btn" onclick="mergeSpingrids()">Merge Spingrids</button>
        </div>
    `;
    
    // Display both spingrids
    displaySpingridFormat(spinitronMatches, 'csvSpingridContent');
    displaySpingridFormat(onlineradioboxMatches, 'excelSpingridContent');
}

// Display spingrid format for specific container
function displaySpingridFormat(matches, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No data available.</p>';
        return;
    }
    
    // Get the artist list from the input
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (artistList.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No artists entered for search.</p>';
        return;
    }
    
    // Group matches by artist and song for spin counts
    const spinCounts = {};
    matches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
        }
        if (!spinCounts[match.artist][match.song]) {
            spinCounts[match.artist][match.song] = {};
        }
        if (!spinCounts[match.artist][match.song][match.station]) {
            spinCounts[match.artist][match.song][match.station] = 0;
        }
        spinCounts[match.artist][match.song][match.station]++;
    });
    
    let html = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
        // Create a separate section for each artist
        html += `<div class="artist-section">`;
        html += `<div class="artist-header">${escapeHtml(artistName.toUpperCase())}</div>`;
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - show all their songs
            const songs = tracklistDatabase[tracklistArtist];
            songs.forEach(songName => {
                // Check if this song has spins
                const songSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][songName];
                
                if (songSpins) {
                    // Song has spins - show count and stations
                    const totalCount = Object.values(songSpins).reduce((sum, count) => sum + count, 0);
                    const stationList = Object.entries(songSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    
                    html += `<div class="song-count-entry">`;
                    html += `<span class="song-name-cell">${escapeHtml(songName)}</span>`;
                    html += `<span class="count-cell">${totalCount}</span>`;
                    html += `<span class="station-cell">${escapeHtml(stationList)}</span>`;
                    html += `</div>`;
                } else {
                    // Song has no spins - show empty
                    html += `<div class="song-count-entry">`;
                    html += `<span class="song-name-cell">${escapeHtml(songName)}</span>`;
                    html += `<span class="count-cell"></span>`;
                    html += `<span class="station-cell"></span>`;
                    html += `</div>`;
                }
            });
        } else {
            // Artist not in tracklist database - show empty entry
            html += `<div class="song-count-entry">`;
            html += `<span class="song-name-cell">No tracks in database</span>`;
            html += `<span class="count-cell"></span>`;
            html += `<span class="station-cell"></span>`;
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// Simple merge function (placeholder for now)
function mergeSpingrids() {
    // For now, just show a simple message
    alert('Merge functionality will be added later. For now, you can see both datasets separately.');
}

// Show both Spinitron and Online Radio Box results with separate formatting options
function showSpinitronWithBothResults() {
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = `
        <div class="results-header">
            <h3>Spinitron Results</h3>
        </div>
        
        <!-- Spinitron Results Section -->
        <div class="dataset-section">
            <div class="dataset-header">
                <h4>Spinitron Data (${spinitronMatches.length} spins)</h4>
                <div class="format-toggles">
                    <button class="format-btn active" onclick="showCsvFormat('table')" id="csvTableFormatBtn">Table</button>
                    <button class="format-btn" onclick="showCsvFormat('station')" id="csvStationFormatBtn">Station Format</button>
                    <button class="format-btn" onclick="showCsvFormat('spingrid')" id="csvSpingridFormatBtn">Spingrid</button>
                </div>
            </div>
            <div class="dataset-content" id="csvResultsContent"></div>
        </div>
        
        <!-- Online Radio Box Results Section -->
        <div class="dataset-section">
            <div class="dataset-header">
                <h4>Online Radio Box Data (${onlineradioboxMatches.length} spins)</h4>
                <div class="format-toggles">
                    <button class="format-btn active" onclick="showExcelFormat('table')" id="excelTableFormatBtn">Table</button>
                    <button class="format-btn" onclick="showExcelFormat('station')" id="excelStationFormatBtn">Station Format</button>
                    <button class="format-btn" onclick="showExcelFormat('spingrid')" id="excelSpingridFormatBtn">Spingrid</button>
                </div>
            </div>
            <div class="dataset-content" id="excelResultsContent"></div>
        </div>
        
        <!-- Merge Section -->
        <div class="merge-section">
            <div class="merge-header">
                <h4>Combined Results</h4>
                <p>Merge Spinitron and Online Radio Box data together</p>
            </div>
            <div class="merge-controls">
                <button class="process-btn" onclick="showMergedResults()">Merge Both Datasets</button>
            </div>
            <div class="merge-content" id="mergedResultsContent" style="display: none;"></div>
        </div>
    `;
    
    // Show both in table format initially
    showCsvFormat('table');
    showExcelFormat('table');
}

// Show Spinitron data in specified format
function showCsvFormat(format) {
    // Update button states
    document.querySelectorAll('#csvTableFormatBtn, #csvStationFormatBtn, #csvSpingridFormatBtn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`csv${format.charAt(0).toUpperCase() + format.slice(1)}FormatBtn`).classList.add('active');
    
    // Display Spinitron data in specified format
    displayResultsInFormat(spinitronMatches, 'csvResultsContent', format);
}

// Show Online Radio Box data in specified format
function showExcelFormat(format) {
    // Update button states
    document.querySelectorAll('#excelTableFormatBtn, #excelStationFormatBtn, #excelSpingridFormatBtn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`excel${format.charAt(0).toUpperCase() + format.slice(1)}FormatBtn`).classList.add('active');
    
    // Display Online Radio Box data in specified format
    displayResultsInFormat(onlineradioboxMatches, 'excelResultsContent', format);
}

// Display results in specified format for a specific container
function displayResultsInFormat(matches, containerId, format) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    switch (format) {
        case 'table':
            displayTableFormatInContainer(matches, container);
            break;
        case 'station':
            displayStationFormatInContainer(matches, container);
            break;
        case 'spingrid':
            displaySpingridFormatInContainer(matches, container);
            break;
    }
}

// Display table format in specific container
function displayTableFormatInContainer(matches, container) {
    let html = '<div class="results-table-container"><table class="results-table"><thead><tr><th>Station</th><th>Artist</th><th>Song</th></tr></thead><tbody>';
    
    matches.forEach(match => {
        html += `<tr><td>${escapeHtml(match.station)}</td><td>${escapeHtml(match.artist)}</td><td>${escapeHtml(match.song)}</td></tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}


// Display station format in specific container
function displayStationFormatInContainer(matches, container) {
    // Group by artist first, then by station and song
    const artistGroups = {};
    matches.forEach(match => {
        if (!artistGroups[match.artist]) {
            artistGroups[match.artist] = {};
        }
        if (!artistGroups[match.artist][match.station]) {
            artistGroups[match.artist][match.station] = {};
        }
        if (!artistGroups[match.artist][match.station][match.song]) {
            artistGroups[match.artist][match.station][match.song] = 0;
        }
        artistGroups[match.artist][match.station][match.song]++;
    });
    
    let html = '';
    Object.keys(artistGroups).sort().forEach(artistName => {
        html += `<div class="artist-section"><div class="artist-header">${escapeHtml(artistName)}</div>`;
        
        const stations = artistGroups[artistName];
        Object.keys(stations).sort().forEach(stationName => {
            const songs = stations[stationName];
            const songEntries = Object.entries(songs).map(([songName, count]) => {
                return count > 1 ? `"${escapeHtml(songName)}" (${count})` : `"${escapeHtml(songName)}"`;
            });
            
            html += `<div class="station-entry">${escapeHtml(stationName)} Spun - ${songEntries.join(', ')}</div>`;
        });
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// Display spingrid format in specific container
function displaySpingridFormatInContainer(matches, container) {
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No data available.</p>';
        return;
    }
    
    // Get the artist list from the input
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (artistList.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No artists entered for search.</p>';
        return;
    }
    
    // Group matches by artist and song for spin counts
    // Use normalized song names as keys to handle case variations (e.g., "This is" vs "This Is")
    const spinCounts = {};
    const songNameMap = {}; // Maps normalized key -> original song name (for display)
    
    matches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
            songNameMap[match.artist] = {};
        }
        
        // Normalize song name for grouping (case-insensitive)
        const normalizedSong = normalizeText(match.song);
        
        // Use normalized key, but track original song name for display
        // Prefer the first occurrence or one that matches database if available
        if (!spinCounts[match.artist][normalizedSong]) {
            spinCounts[match.artist][normalizedSong] = {};
            songNameMap[match.artist][normalizedSong] = match.song;
        }
        
        if (!spinCounts[match.artist][normalizedSong][match.station]) {
            spinCounts[match.artist][normalizedSong][match.station] = 0;
        }
        spinCounts[match.artist][normalizedSong][match.station]++;
    });
    
    let html = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
        // Create a separate section for each artist
        html += `<div class="artist-section"><div class="artist-header">${escapeHtml(artistName.toUpperCase())}</div>`;
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - show all their songs
            const songs = tracklistDatabase[tracklistArtist];
            const tracklistArtistLower = tracklistArtist.toLowerCase();
            
            // Group variants under their parent tracks (same logic as main displaySpingridFormat)
            const parentGroups = {};
            const standaloneSongs = [];
            
            songs.forEach(songName => {
                // Check if this song is itself a variant (case-insensitive artist matching)
                const normalizedSongName = normalizeText(songName);
                const isVariant = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist, variantSong] = key.split('|');
                    const normalizedVariantSong = normalizeText(variantSong);
                    return variantArtist.toLowerCase() === tracklistArtistLower && normalizedVariantSong === normalizedSongName;
                });
                
                if (isVariant) {
                    return;
                }
                
                // Check if this song is a parent (has variants pointing to it for this artist)
                // Use case-insensitive matching for artist and normalize parent song for comparison
                const hasVariants = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist] = key.split('|');
                    const normalizedParent = normalizeText(parent);
                    return variantArtist.toLowerCase() === tracklistArtistLower && normalizedParent === normalizedSongName;
                });
                
                if (hasVariants) {
                    if (!parentGroups[songName]) {
                        parentGroups[songName] = {
                            variants: [],
                            spins: {}
                        };
                    }
                    
                    Object.entries(trackVariants).forEach(([key, parent]) => {
                        const [variantArtist] = key.split('|');
                        const normalizedParent = normalizeText(parent);
                        if (variantArtist.toLowerCase() === tracklistArtistLower && normalizedParent === normalizedSongName) {
                            const [, variantSong] = key.split('|');
                            if (variantSong) {
                                parentGroups[songName].variants.push(variantSong);
                                const normalizedVariant = normalizeText(variantSong);
                                // Find matching artist in spinCounts (case-insensitive)
                                const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                                const variantSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedVariant];
                                if (variantSpins) {
                                    Object.entries(variantSpins).forEach(([station, count]) => {
                                        if (!parentGroups[songName].spins[station]) {
                                            parentGroups[songName].spins[station] = 0;
                                        }
                                        parentGroups[songName].spins[station] += count;
                                    });
                                }
                            }
                        }
                    });
                    
                    // Try exact match first for parent track (normalize to match normalized keys)
                    const normalizedParentSong = normalizeText(songName);
                    let parentSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][normalizedParentSong];
                    
                    // If not found, try fuzzy match (keys are already normalized, so compare normalized lookup)
                    if (!parentSpins && spinCounts[tracklistArtist]) {
                        const foundMatch = Object.keys(spinCounts[tracklistArtist]).find(spinSong => {
                            return normalizedParentSong === spinSong || 
                                   similarityRatio(normalizedParentSong, spinSong) >= FUZZY_THRESHOLD;
                        });
                        if (foundMatch) {
                            parentSpins = spinCounts[tracklistArtist][foundMatch];
                        }
                    }
                    
                    if (parentSpins) {
                        Object.entries(parentSpins).forEach(([station, count]) => {
                            if (!parentGroups[songName].spins[station]) {
                                parentGroups[songName].spins[station] = 0;
                            }
                            parentGroups[songName].spins[station] += count;
                        });
                    }
                } else {
                    standaloneSongs.push(songName);
                }
            });
            
            // Display parent tracks with variants
            Object.keys(parentGroups).forEach(parentSong => {
                const group = parentGroups[parentSong];
                const totalCount = Object.values(group.spins).reduce((sum, count) => sum + count, 0);
                const stationList = Object.entries(group.spins)
                    .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                    .join(', ');
                
                html += `<div class="song-count-entry parent-track"><span class="song-name-cell">${escapeHtml(parentSong)}</span><span class="count-cell">${totalCount > 0 ? totalCount : ''}</span><span class="station-cell">${totalCount > 0 ? escapeHtml(stationList) : ''}</span></div>`;
                
                if (group.variants.length > 0) {
                    group.variants.forEach(variantSong => {
                        const normalizedVariant = normalizeText(variantSong);
                        // Find matching artist in spinCounts (case-insensitive)
                        const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                        const variantSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedVariant];
                        const variantCount = variantSpins ? Object.values(variantSpins).reduce((sum, count) => sum + count, 0) : 0;
                        const variantStationList = variantSpins ? Object.entries(variantSpins)
                            .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                            .join(', ') : '';
                        
                        html += `<div class="song-count-entry variant-track"><span class="song-name-cell" style="padding-left: 20px; color: #718096;">→ ${escapeHtml(variantSong)}</span><span class="count-cell">${variantCount > 0 ? variantCount : ''}</span><span class="station-cell">${variantCount > 0 ? escapeHtml(variantStationList) : ''}</span></div>`;
                    });
                }
            });
            
            // Display standalone songs - group by normalized name to handle case variations
            const groupedStandaloneSongs = {};
            standaloneSongs.forEach(songName => {
                const normalizedSong = normalizeText(songName);
                if (!groupedStandaloneSongs[normalizedSong]) {
                    groupedStandaloneSongs[normalizedSong] = {
                        displayName: songName, // Use first occurrence as display name
                        aggregatedSpins: {}
                    };
                }
                // Aggregate spins from all case variations
                const normalizedSongKey = normalizeText(songName);
                const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                const songSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedSongKey];
                
                if (songSpins) {
                    Object.entries(songSpins).forEach(([station, count]) => {
                        if (!groupedStandaloneSongs[normalizedSong].aggregatedSpins[station]) {
                            groupedStandaloneSongs[normalizedSong].aggregatedSpins[station] = 0;
                        }
                        groupedStandaloneSongs[normalizedSong].aggregatedSpins[station] += count;
                    });
                }
            });
            
            // Display grouped standalone songs
            Object.entries(groupedStandaloneSongs).forEach(([normalizedKey, group]) => {
                const aggregatedSpins = group.aggregatedSpins;
                const totalCount = Object.values(aggregatedSpins).reduce((sum, count) => sum + count, 0);
                
                if (totalCount > 0) {
                    const stationList = Object.entries(aggregatedSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    
                    html += `<div class="song-count-entry"><span class="song-name-cell">${escapeHtml(group.displayName)}</span><span class="count-cell">${totalCount}</span><span class="station-cell">${escapeHtml(stationList)}</span></div>`;
                } else {
                    html += `<div class="song-count-entry"><span class="song-name-cell">${escapeHtml(group.displayName)}</span><span class="count-cell"></span><span class="station-cell"></span></div>`;
                }
            });
        } else {
            // Artist not in tracklist database - show empty entry
            html += `<div class="song-count-entry"><span class="song-name-cell">No tracks in database</span><span class="count-cell"></span><span class="station-cell"></span></div>`;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// Show merged results from both Spinitron and Online Radio Box data
function showMergedResults() {
    const mergedContent = document.getElementById('mergedResultsContent');
    const mergeButton = document.querySelector('.merge-controls .process-btn');
    
    if (mergedContent.style.display === 'none') {
        // Show merged content
        mergedContent.style.display = 'block';
        mergeButton.textContent = 'Hide Merged Results';
        
        // Combine both datasets
        const combinedMatches = [...spinitronMatches, ...onlineradioboxMatches];
        
        // Display merged results in table format
        displayMergedResults(combinedMatches);
    } else {
        // Hide merged content
        mergedContent.style.display = 'none';
        mergeButton.textContent = 'Merge Both Datasets';
    }
}

// Display merged results
function displayMergedResults(combinedMatches) {
    const mergedContent = document.getElementById('mergedResultsContent');
    
    if (combinedMatches.length === 0) {
        mergedContent.innerHTML = '<p style="text-align: center; color: #718096;">No data to merge.</p>';
        return;
    }
    
    // Group by artist and song for spin counts
    const spinCounts = {};
    combinedMatches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
        }
        if (!spinCounts[match.artist][match.song]) {
            spinCounts[match.artist][match.song] = {};
        }
        if (!spinCounts[match.artist][match.song][match.station]) {
            spinCounts[match.artist][match.song][match.station] = 0;
        }
        spinCounts[match.artist][match.song][match.station]++;
    });
    
    let html = `
        <div class="merged-results-header">
            <h5>Combined Data (${combinedMatches.length} total spins)</h5>
            <div class="merged-format-toggles">
                <button class="format-btn active" onclick="showMergedFormat('table')" id="mergedTableFormatBtn">Table</button>
                <button class="format-btn" onclick="showMergedFormat('station')" id="mergedStationFormatBtn">Station Format</button>
                <button class="format-btn" onclick="showMergedFormat('spingrid')" id="mergedSpingridFormatBtn">Spingrid</button>
            </div>
        </div>
        <div class="merged-results-content" id="mergedResultsDisplay"></div>
        <div class="merged-excel-controls" id="mergedExcelControls" style="display: none;">
            <button class="process-btn" onclick="copyMergedSpingridForExcel()">Copy for Excel</button>
        </div>
    `;
    
    mergedContent.innerHTML = html;
    
    // Show in table format initially
    showMergedFormat('table');
}

// Show merged data in specified format
function showMergedFormat(format) {
    // Update button states
    document.querySelectorAll('#mergedTableFormatBtn, #mergedStationFormatBtn, #mergedSpingridFormatBtn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`merged${format.charAt(0).toUpperCase() + format.slice(1)}FormatBtn`).classList.add('active');
    
    // Show/hide Excel controls based on format
    const excelControls = document.getElementById('mergedExcelControls');
    if (excelControls) {
        excelControls.style.display = format === 'spingrid' ? 'block' : 'none';
    }
    
    // Combine both datasets
    const combinedMatches = [...spinitronMatches, ...onlineradioboxMatches];
    
    // Display in specified format
    displayResultsInFormat(combinedMatches, 'mergedResultsDisplay', format);
}

// Copy merged spingrid for Excel (preserving function name for compatibility)
function copyMergedSpingridForExcel() {
    const combinedMatches = [...spinitronMatches, ...onlineradioboxMatches];
    
    if (combinedMatches.length === 0) {
        alert('no data to copy.');
        return;
    }
    
    // Get the artist list from the input
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (artistList.length === 0) {
        alert('no artists entered for search.');
        return;
    }
    
    // Group matches by artist and song for spin counts (use normalized keys like display)
    const spinCounts = {};
    combinedMatches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
        }
        
        // Normalize song name for grouping (case-insensitive)
        const normalizedSong = normalizeText(match.song);
        
        if (!spinCounts[match.artist][normalizedSong]) {
            spinCounts[match.artist][normalizedSong] = {};
        }
        if (!spinCounts[match.artist][normalizedSong][match.station]) {
            spinCounts[match.artist][normalizedSong][match.station] = 0;
        }
        spinCounts[match.artist][normalizedSong][match.station]++;
    });
    
    let excelData = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - group by normalized name to handle duplicates
            const songs = tracklistDatabase[tracklistArtist];
            const tracklistArtistLower = tracklistArtist.toLowerCase();
            
            // Group songs by normalized name (to handle case variations in database)
            const groupedSongs = {};
            songs.forEach(songName => {
                const normalizedSong = normalizeText(songName);
                if (!groupedSongs[normalizedSong]) {
                    groupedSongs[normalizedSong] = {
                        displayName: songName, // Use first occurrence as display name
                        aggregatedSpins: {}
                    };
                }
                
                // Aggregate spins from all case variations
                const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                const songSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedSong];
                
                if (songSpins) {
                    Object.entries(songSpins).forEach(([station, count]) => {
                        if (!groupedSongs[normalizedSong].aggregatedSpins[station]) {
                            groupedSongs[normalizedSong].aggregatedSpins[station] = 0;
                        }
                        groupedSongs[normalizedSong].aggregatedSpins[station] += count;
                    });
                }
            });
            
            // Display grouped songs
            Object.entries(groupedSongs).forEach(([normalizedKey, group]) => {
                const aggregatedSpins = group.aggregatedSpins;
                const totalCount = Object.values(aggregatedSpins).reduce((sum, count) => sum + count, 0);
                
                if (totalCount > 0) {
                    const stationList = Object.entries(aggregatedSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    excelData += `${group.displayName}\t${totalCount}\t${stationList}\n`;
                } else {
                    excelData += `${group.displayName}\t\t\n`;
                }
            });
        }
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(excelData).then(() => {
        alert('merged spingrid data copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('failed to copy to clipboard. please try again.');
    });
}

// Process Spinitron data in fallback mode (no tracklist database match)
function processCsvDataFallback(matches) {
    // Store Spinitron data separately
    spinitronMatches = [...matches];
    
    // Show the results display
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.style.display = 'block';
    
    // Keep the load section visible so user can upload a new file to replace this one
    // Don't hide it - just keep it available for new uploads
    
    // Show fallback results with limited formatting options
    showCsvFallbackResults(matches);
    
    // Update summary
    const summaryEl = document.getElementById('summary');
    if (summaryEl) {
        summaryEl.textContent = `${matches.length} spins loaded from Spinitron file. No matching artists found in tracklist database - showing basic analysis.`;
    }
}

// Show Spinitron results in fallback mode (limited formatting options)
function showCsvFallbackResults(matches) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = `
        <div class="results-header">
            <h3>Spinitron Results (Fallback Mode)</h3>
        </div>
            <div class="fallback-notice">
                <p><strong>Note:</strong> No matching artists found in tracklist database. Showing basic analysis only.</p>
            </div>
        </div>
        
        <!-- Spinitron Results Section -->
        <div class="dataset-section">
            <div class="dataset-header">
                <h4>Spinitron Data (${matches.length} spins)</h4>
                <div class="format-toggles">
                    <button class="format-btn active" onclick="showCsvFallbackFormat('table')" id="csvFallbackTableFormatBtn">Table</button>
                    <button class="format-btn" onclick="showCsvFallbackFormat('station')" id="csvFallbackStationFormatBtn">Station Format</button>
                </div>
            </div>
            <div class="dataset-content" id="csvFallbackResultsContent"></div>
        </div>
        
        <div class="fallback-info">
            <h4>To get full spingrid formatting:</h4>
            <p>Add the artist(s) to your tracklist database first, then re-upload the Spinitron file.</p>
            <button class="process-btn" onclick="showTracklistManager()">Manage Tracklist Database</button>
        </div>
    `;
    
    // Show in table format initially
    showCsvFallbackFormat('table');
}

// Show Spinitron fallback data in specified format
function showCsvFallbackFormat(format) {
    // Update button states
    document.querySelectorAll('#csvFallbackTableFormatBtn, #csvFallbackStationFormatBtn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`csvFallback${format.charAt(0).toUpperCase() + format.slice(1)}FormatBtn`).classList.add('active');
    
    // Display Spinitron data in specified format
    displayResultsInFormat(spinitronMatches, 'csvFallbackResultsContent', format);
}

// Placeholder for merged spingrid (simplified for now)
function showMergedSpingrid() {
    alert('Merged view will be added later. For now, you can see both datasets separately.');
}

// Load file from server
async function loadStoredFile() {
    try {
        // Try localhost first, then fall back to relative URL for Netlify
        let baseUrl = 'http://localhost:3001';
        if (window.location.hostname !== 'localhost') {
            baseUrl = ''; // Use relative URLs for production
        }
        
        const response = await fetch('/api/file');
        if (!response.ok) {
            throw new Error('File not found on server');
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
        console.log('Workbook loaded from server, sheets:', workbook.SheetNames.length);
            workbookRef = workbook;
            headersBySheet = {};
            
            // derive headers from first non-empty sheet
            let firstHeaders = null;
            for (const name of workbook.SheetNames) {
                const ws = workbook.Sheets[name];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (jsonData.length > 0 && jsonData[0].length > 0) {
                    headersBySheet[name] = jsonData[0];
                    if (!firstHeaders) firstHeaders = jsonData[0];
                }
            }
            if (!firstHeaders) {
                alert('The Online Radio Box file appears to be empty.');
                return;
            }
            
            console.log('Headers found:', firstHeaders);
            
            // Clear Spinitron data when a new ORB file is loaded
            clearSpinitronDisplay();
            
            showProcessingSection();
            
        } catch (error) {
        console.error('Error loading file from server:', error);
        
        // More specific error messages
        let errorMessage = 'Error loading the Online Radio Box file from server. ';
        if (error.message.includes('404') || error.message.includes('not found')) {
            errorMessage += 'No file has been uploaded yet. Please ask an admin to upload a file first.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage += 'Network error. Please check your connection and try again.';
        } else {
            errorMessage += 'Please make sure an admin has uploaded a file and try again.';
        }
        
        alert(errorMessage);
    }
}

// Show processing section
function showProcessingSection() {
    document.getElementById('processingSection').style.display = 'block';
}

// Parse combined Artist/Song strings in a variety of formats
// Supports examples like:
// - "Artist - Song"
// - "Song - Artist" (auto-detected using the provided artist set)
// - "Song - Artist - Album" (3-part format)
// - "TEXT=song-artist" (anything before '=' ignored; assumes song-artist ordering if artistSet helps)
// - "Song By: Artist" or "Song by Artist"
function parseArtistSong(raw, artistSet) {
    if (!raw) return { artist: '', song: '' };
    let str = String(raw).trim();
    if (!str) return { artist: '', song: '' };

    // If there's a key=value form, take the value part
    const eqIdx = str.lastIndexOf('=');
    if (eqIdx !== -1) {
        str = str.slice(eqIdx + 1).trim();
        
        // Special handling for TEXT=song-artist format (single dash)
        if (str.includes('-') && !str.includes(' - ')) {
            const dashIdx = str.lastIndexOf('-');
            const song = str.slice(0, dashIdx).trim();
            let artist = str.slice(dashIdx + 1).trim();
            
            // Normalize "Last, First" format to "First Last"
            const lastFirstMatch = artist.match(/^(.+),\s*(.+)$/);
            if (lastFirstMatch) {
                const lastName = lastFirstMatch[1].trim();
                const firstName = lastFirstMatch[2].trim();
                artist = `${firstName} ${lastName}`;
            }
            
            // Check if the artist part matches our artist set
            if (artistSet && artistSet.has(artist.toLowerCase())) {
                return { artist, song };
            }
        }
    }

    // Handle "Song By: Artist" or "Song by Artist" or "Song by Artist on Program"
    const byMatch = str.match(/^(.+?)\s+by[:\-]?\s+(.+)$/i);
    if (byMatch) {
        const song = byMatch[1].trim();
        let artist = byMatch[2].trim();
        
        // Strip out common station suffixes like "now on KUTX 98.9 FM" or "on Radio Program"
        artist = artist.replace(/\s+(now\s+on|playing\s+on|on)\s+.+$/i, '').trim();
        
        return { artist, song };
    }

    // Try common separators, prefer the left as artist unless artistSet disambiguates
    const separators = [' - ', ' – ', ' — ', ' | ', ' / ', ' -- '];
    for (const sep of separators) {
        if (str.includes(sep)) {
            const parts = str.split(sep);
            if (parts.length >= 2) {
                const left = parts[0].trim();
                const right = parts.slice(1).join(sep).trim();
                const leftLower = left.toLowerCase();
                const rightLower = right.toLowerCase();
                const leftIsArtist = artistSet && artistSet.has(leftLower);
                const rightIsArtist = artistSet && artistSet.has(rightLower);

                // Special handling for 3-part format: "Song - Artist - Album"
                if (parts.length === 3) {
                    const song = parts[0].trim();
                    let artist = parts[1].trim();
                    const album = parts[2].trim();
                    
                    // Normalize "Last, First" format to "First Last"
                    const lastFirstMatch = artist.match(/^(.+),\s*(.+)$/);
                    if (lastFirstMatch) {
                        const lastName = lastFirstMatch[1].trim();
                        const firstName = lastFirstMatch[2].trim();
                        artist = `${firstName} ${lastName}`;
                    }
                    
                    // Check if the middle part (artist) matches our artist set
                    if (artistSet && artistSet.has(artist.toLowerCase())) {
                        return { artist, song };
                    }
                    // If not, fall back to normal 2-part logic
                }

                if (leftIsArtist && !rightIsArtist) {
                    return { artist: left, song: right };
                }
                if (!leftIsArtist && rightIsArtist) {
                    return { artist: right, song: left };
                }
                
                // Try normalizing "Last, First" format for both sides
                let normalizedLeft = left;
                let normalizedRight = right;
                
                const leftLastFirstMatch = left.match(/^(.+),\s*(.+)$/);
                if (leftLastFirstMatch) {
                    const lastName = leftLastFirstMatch[1].trim();
                    const firstName = leftLastFirstMatch[2].trim();
                    normalizedLeft = `${firstName} ${lastName}`;
                }
                
                const rightLastFirstMatch = right.match(/^(.+),\s*(.+)$/);
                if (rightLastFirstMatch) {
                    const lastName = rightLastFirstMatch[1].trim();
                    const firstName = rightLastFirstMatch[2].trim();
                    normalizedRight = `${firstName} ${lastName}`;
                }
                
                // Check normalized versions
                const normalizedLeftIsArtist = artistSet && artistSet.has(normalizedLeft.toLowerCase());
                const normalizedRightIsArtist = artistSet && artistSet.has(normalizedRight.toLowerCase());
                
                if (normalizedLeftIsArtist && !normalizedRightIsArtist) {
                    return { artist: normalizedLeft, song: right };
                }
                if (!normalizedLeftIsArtist && normalizedRightIsArtist) {
                    return { artist: normalizedRight, song: left };
                }
                
                // Default assumption: left is artist, right is song
                return { artist: left, song: right };
            }
        }
    }

    // If we reach here, we couldn't parse
    return { artist: '', song: '' };
}

// Find matches across all sheets and enable download
async function findMatches() {
    if (!workbookRef) {
        alert('Please load a file first.');
        return;
    }
    
    // Clear Spinitron data when searching for a different artist in ORB
    clearSpinitronDisplay();
    
    // parse artist names
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    const artistSet = new Set(artistList.map(a => a.toLowerCase()))
    if (artistSet.size === 0) {
        alert('Please enter at least one artist name.');
        return;
    }
    
    matches = [];
    const summary = { rowsScanned: 0, sheetsScanned: 0 };
    const progressEl = document.getElementById('progress');
    const downloadBtn = document.getElementById('downloadCsvBtn');
    const findBtn = document.getElementById('findBtn');
    downloadBtn.disabled = true;
    findBtn.disabled = true;
    findBtn.innerHTML = '<span class="loading"></span> Processing...';
    
    const sheetNames = workbookRef.SheetNames;
    for (let s = 0; s < sheetNames.length; s++) {
        const sheetName = sheetNames[s];
        progressEl.textContent = `Scanning sheet ${s + 1}/${sheetNames.length}: ${sheetName}...`;
        // Yield to UI before heavy work
        await new Promise(r => setTimeout(r, 0));
        
        const ws = workbookRef.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) continue;
        summary.sheetsScanned++;
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            summary.rowsScanned++;
            
            // Extract artist/song from up to first 5 columns robustly
            const extracted = extractArtistSongFromRow(row, artistList, artistSet);
            let artist = extracted.artist;
            let song = extracted.song;
            
            if (!artist || !song) continue;
            if (artistSet.has(artist.toLowerCase())) {
                // Check if song is in tracklist database (if available)
                const hasTracklist = Object.keys(tracklistDatabase).length > 0;
                if (hasTracklist) {
                    const tlMatch = matchTracklistFuzzy(artist, song);
                    if (tlMatch.ok) {
                        // Canonicalize artist and song to database values so downstream lookups align
                        matches.push({ station: sheetName, artist: tlMatch.artist, song: tlMatch.song });
                    } else {
                        // Artist not in tracklist database - still return the spin
                        matches.push({ station: sheetName, artist, song });
                    }
                } else {
                    // No tracklist database - return all results
                    matches.push({ station: sheetName, artist, song });
                }
            }
            // Yield occasionally on large rows to keep UI responsive
            if (i % 1000 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }
    
    // Sort matches by artist order (as entered) then by song title
    const sortedMatches = sortMatchesByArtistOrder(matches, artistList);
    
    // Display ORB results immediately
    matches = sortedMatches;
    downloadBtn.disabled = matches.length === 0;
    findBtn.disabled = false;
    findBtn.innerHTML = 'Find Matches';
    findBtn.classList.remove('loading');
    progressEl.textContent = '';
    const summaryEl = document.getElementById('summary');
    summaryEl.textContent = `${matches.length} Online Radio Box matches across ${summary.sheetsScanned} sheets (${summary.rowsScanned} rows scanned). Fetching KEXP data...`;
    
    // Display results in current format immediately
    displayResults(matches);
    
    // Fetch KEXP data in background and add to results when done
    fetchKexpDataForArtists(artistList, (msg) => {
        // Update progress in summary
        summaryEl.textContent = `${matches.length} Online Radio Box matches across ${summary.sheetsScanned} sheets (${summary.rowsScanned} rows scanned). ${msg}`;
    }).then(kexpResults => {
        // Merge KEXP results with Online Radio Box matches
        matches = [...matches, ...kexpResults];
        
        // Re-sort combined results
        matches = sortMatchesByArtistOrder(matches, artistList);
        
        // Update display with merged results
        displayResults(matches);
        
        // Update summary
        const kexpCount = kexpResults.length;
        const orbCount = matches.length - kexpCount;
        summaryEl.textContent = `${orbCount} Online Radio Box matches across ${summary.sheetsScanned} sheets (${summary.rowsScanned} rows scanned). ${kexpCount > 0 ? `${kexpCount} KEXP matches.` : 'No KEXP matches found.'}`;
    }).catch(error => {
        console.error('Error fetching KEXP data:', error);
        summaryEl.textContent = `${matches.length} Online Radio Box matches across ${summary.sheetsScanned} sheets (${summary.rowsScanned} rows scanned). KEXP fetch failed.`;
    });
}

// Try multiple columns and strategies to extract artist/song
function extractArtistSongFromRow(row, artistList, artistSet) {
    // Consider first 5 columns A..E
    const cells = [];
    for (let c = 0; c < 5; c++) cells.push(safeCell(row, c));
    let best = { artist: '', song: '', score: 0 };
    
    // Debug: log first few rows to see what we're getting
    if (row.length > 0 && Math.random() < 0.01) { // Log 1% of rows for debugging
        console.log('Row data:', cells);
    }
    
    // 1) Try all pairs (artistCol, songCol)
    for (let i = 0; i < cells.length; i++) {
        for (let j = 0; j < cells.length; j++) {
            if (i === j) continue;
            const candArtist = getBestArtistFromList(cells[i], artistList);
            if (candArtist && candArtist.score >= FUZZY_THRESHOLD) {
                const score = candArtist.score;
                // Skip if song looks like a number or timestamp
                if (score > best.score && cells[j] && !isNumericOrTimestamp(cells[j])) {
                    best = { artist: candArtist.name, song: cells[j], score };
                }
            }
        }
    }
    // 2) Try each single cell as combined "Artist - Song"
    for (let i = 0; i < cells.length; i++) {
        const combined = parseArtistSong(cells[i], artistSet);
        if (combined.artist && combined.song) {
            const candArtist = getBestArtistFromList(combined.artist, artistList);
            if (candArtist && candArtist.score >= FUZZY_THRESHOLD) {
                const score = candArtist.score;
                // Skip if song looks like a number or timestamp
                if (score > best.score && !isNumericOrTimestamp(combined.song)) {
                    best = { artist: candArtist.name, song: combined.song, score };
                }
            }
        }
    }
    return { artist: best.artist, song: best.song };
}

// Check if a string looks like a number or timestamp
function isNumericOrTimestamp(str) {
    if (!str) return true;
    const s = String(str).trim();
    // Check if it's mostly numbers with dots (like 45926.00063657408)
    if (/^\d+\.\d+$/.test(s)) return true;
    // Check if it's a pure number
    if (/^\d+$/.test(s)) return true;
    // Check if it's a date/time format
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    return false;
}

// Sort matches by artist order (as entered) then by song title
function sortMatchesByArtistOrder(matches, artistList) {
    // Create a map of artist names to their order index
    const artistOrderMap = new Map();
    artistList.forEach((artist, index) => {
        artistOrderMap.set(artist.toLowerCase(), index);
    });
    
    return matches.sort((a, b) => {
        const aOrder = artistOrderMap.get(a.artist.toLowerCase()) ?? 999;
        const bOrder = artistOrderMap.get(b.artist.toLowerCase()) ?? 999;
        
        // First sort by artist order
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }
        
        // Then sort by song title alphabetically
        return a.song.localeCompare(b.song, undefined, { sensitivity: 'base' });
    });
}

// Display results in the current format
function displayResults(matches) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    
    if (matches.length === 0) {
        resultsDisplay.style.display = 'none';
        return;
    }
    
    // Show the results display
    resultsDisplay.style.display = 'block';
    
    // Display in current format
    switch (currentResultFormat) {
        case 'table':
            displayTableFormat(matches);
            break;
        case 'station':
            displayStationFormat(matches);
            break;
        case 'spingrid':
            displaySpingridFormat(matches);
            break;
    }
}

// Display results in table format
function displayTableFormat(matches) {
    const resultsTableBody = document.getElementById('resultsTableBody');
    
    // Clear existing rows
    resultsTableBody.innerHTML = '';
    
    // Add rows for each match
    matches.forEach((match, index) => {
        const row = document.createElement('tr');
        
        // Highlight KEXP results in green
        if (match.source === 'kexp') {
            row.style.backgroundColor = '#e6f7e6'; // Light green background
}

        // Check if this track is a variant (case-insensitive matching)
        const matchArtistLower = match.artist.toLowerCase();
        const normalizedMatchSong = normalizeText(match.song);
        let variantParent = null;
        for (const [key, parent] of Object.entries(trackVariants)) {
            const [variantArtist, variantSong] = key.split('|');
            const normalizedVariantSong = normalizeText(variantSong);
            if (variantArtist.toLowerCase() === matchArtistLower && normalizedVariantSong === normalizedMatchSong) {
                variantParent = parent;
                break;
            }
        }
        const variantIndicator = variantParent ? ` <span style="color: #718096; font-size: 0.85em;">(variant of ${escapeHtml(variantParent)})</span>` : '';
        
        // Check if this track is in the tracklist database (recognized in spingrid)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === match.artist.toLowerCase()
        );
        const isInTracklist = tracklistArtist && tracklistDatabase[tracklistArtist] && 
            isSongInTracklistFuzzy(tracklistArtist, match.song);
        
        // Only show "make variant" button if track is NOT in tracklist database
        // If track is a variant, show variant info in actions column too
        let actionContent = '';
        if (isInTracklist) {
            if (variantParent) {
                actionContent = `<span style="color: #718096; font-size: 0.85em;">in tracklist • variant of ${escapeHtml(variantParent)}</span>`;
            } else {
                actionContent = '<span style="color: #718096; font-size: 0.85em;">in tracklist</span>';
            }
        } else {
            actionContent = `
                <button class="variant-btn" onclick="openVariantModal('${escapeHtml(match.artist)}', '${escapeHtml(match.song)}')" title="Make this track a variant of another track">
                    make variant
                </button>
            `;
        }
        
        row.innerHTML = `
            <td>${escapeHtml(match.station)}</td>
            <td>${escapeHtml(match.artist)}</td>
            <td>${escapeHtml(match.song)}${variantIndicator}</td>
            <td>${actionContent}</td>
        `;
        resultsTableBody.appendChild(row);
    });
}


// Display results in station format (Station Spun - "Song")
function displayStationFormat(matches) {
    const stationResultsBody = document.getElementById('stationResultsBody');
    
    // Group by artist first, then by station and song
    const artistGroups = {};
    matches.forEach(match => {
        if (!artistGroups[match.artist]) {
            artistGroups[match.artist] = {};
        }
        if (!artistGroups[match.artist][match.station]) {
            artistGroups[match.artist][match.station] = {};
        }
        if (!artistGroups[match.artist][match.station][match.song]) {
            artistGroups[match.artist][match.station][match.song] = 0;
        }
        artistGroups[match.artist][match.station][match.song]++;
    });
    
    let html = '';
    Object.keys(artistGroups).sort().forEach(artistName => {
        html += `<div class="artist-section">`;
        html += `<div class="artist-header">${escapeHtml(artistName)}</div>`;
        
        const stations = artistGroups[artistName];
        Object.keys(stations).sort().forEach(stationName => {
            const songs = stations[stationName];
            const songEntries = Object.entries(songs).map(([songName, count]) => {
                return count > 1 ? `"${escapeHtml(songName)}" (${count})` : `"${escapeHtml(songName)}"`;
            });
            
            html += `<div class="station-entry">${escapeHtml(stationName)} Spun - ${songEntries.join(', ')}</div>`;
        });
        
        html += `</div>`;
    });
    
    stationResultsBody.innerHTML = html;
}

// Display results in spingrid format (uses tracklist database)
function displaySpingridFormat(matches) {
    const spingridResultsBody = document.getElementById('spingridResultsBody');
    
    // Get the artist list from the input
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (artistList.length === 0) {
        spingridResultsBody.innerHTML = '<p style="text-align: center; color: #718096;">No artists entered for search.</p>';
        return;
    }
    
    // Group matches by artist and song for spin counts
    // Use normalized song names as keys to handle case variations (e.g., "This is" vs "This Is")
    const spinCounts = {};
    const songNameMap = {}; // Maps normalized key -> original song name (for display)
    
    matches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
            songNameMap[match.artist] = {};
        }
        
        // Normalize song name for grouping (case-insensitive)
        const normalizedSong = normalizeText(match.song);
        
        // Use normalized key, but track original song name for display
        // Prefer the first occurrence or one that matches database if available
        if (!spinCounts[match.artist][normalizedSong]) {
            spinCounts[match.artist][normalizedSong] = {};
            songNameMap[match.artist][normalizedSong] = match.song;
        }
        
        if (!spinCounts[match.artist][normalizedSong][match.station]) {
            spinCounts[match.artist][normalizedSong][match.station] = 0;
        }
        spinCounts[match.artist][normalizedSong][match.station]++;
    });
    
    let html = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
        // Create a separate section for each artist
        html += `<div class="artist-section">`;
        html += `<div class="artist-header">${escapeHtml(artistName.toUpperCase())}</div>`;
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - show all their songs
            const songs = tracklistDatabase[tracklistArtist];
            const tracklistArtistLower = tracklistArtist.toLowerCase();
            
            // Group variants under their parent tracks
            const parentGroups = {}; // { parentSong: { variants: [...], spins: {...} } }
            const standaloneSongs = []; // Songs that are not variants and have no variants
            
            songs.forEach(songName => {
                // Check if this song is itself a variant (case-insensitive artist matching)
                const normalizedSongName = normalizeText(songName);
                const isVariant = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist, variantSong] = key.split('|');
                    const normalizedVariantSong = normalizeText(variantSong);
                    return variantArtist.toLowerCase() === tracklistArtistLower && normalizedVariantSong === normalizedSongName;
                });
                
                if (isVariant) {
                    // This is a variant - skip it here, will be shown under parent
                    return;
                }
                
                // Check if this song is a parent (has variants pointing to it for this artist)
                // Use case-insensitive matching for artist and normalize parent song for comparison
                const hasVariants = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist] = key.split('|');
                    const normalizedParent = normalizeText(parent);
                    return variantArtist.toLowerCase() === tracklistArtistLower && normalizedParent === normalizedSongName;
                });
                
                if (hasVariants) {
                    // This is a parent track - group variants under it
                    if (!parentGroups[songName]) {
                        parentGroups[songName] = {
                            variants: [],
                            spins: {}
                        };
                    }
                    
                    // Find all variants of this song (for this artist)
                    Object.entries(trackVariants).forEach(([key, parent]) => {
                        const [variantArtist] = key.split('|');
                        const normalizedParent = normalizeText(parent);
                        if (variantArtist.toLowerCase() === tracklistArtistLower && normalizedParent === normalizedSongName) {
                            const [, variantSong] = key.split('|');
                            if (variantSong) {
                                parentGroups[songName].variants.push(variantSong);
                                
                                // Aggregate spins from variant tracks (normalize to match normalized keys)
                                const normalizedVariant = normalizeText(variantSong);
                                const variantSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][normalizedVariant];
                                if (variantSpins) {
                                    Object.entries(variantSpins).forEach(([station, count]) => {
                                        if (!parentGroups[songName].spins[station]) {
                                            parentGroups[songName].spins[station] = 0;
                                        }
                                        parentGroups[songName].spins[station] += count;
                                    });
                                }
                            }
                        }
                    });
                    
                    // Also add spins from the parent track itself (normalize to match normalized keys)
                    const normalizedParentSong = normalizeText(songName);
                    let parentSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][normalizedParentSong];
                    
                    // If not found, try fuzzy match (keys are already normalized, so compare normalized lookup)
                    if (!parentSpins && spinCounts[tracklistArtist]) {
                        const foundMatch = Object.keys(spinCounts[tracklistArtist]).find(spinSong => {
                            return normalizedParentSong === spinSong || 
                                   similarityRatio(normalizedParentSong, spinSong) >= FUZZY_THRESHOLD;
                        });
                        if (foundMatch) {
                            parentSpins = spinCounts[tracklistArtist][foundMatch];
                        }
                    }
                    
                    if (parentSpins) {
                        Object.entries(parentSpins).forEach(([station, count]) => {
                            if (!parentGroups[songName].spins[station]) {
                                parentGroups[songName].spins[station] = 0;
                            }
                            parentGroups[songName].spins[station] += count;
                        });
                    }
                } else {
                    // Standalone song (not a variant and has no variants)
                    standaloneSongs.push(songName);
                }
            });
            
            // Display parent tracks with their variants grouped
            Object.keys(parentGroups).forEach(parentSong => {
                const group = parentGroups[parentSong];
                const totalCount = Object.values(group.spins).reduce((sum, count) => sum + count, 0);
                const stationList = Object.entries(group.spins)
                    .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                    .join(', ');
                
                // Show parent track
                html += `<div class="song-count-entry parent-track">`;
                html += `<span class="song-name-cell">${escapeHtml(parentSong)}</span>`;
                html += `<span class="count-cell">${totalCount > 0 ? totalCount : ''}</span>`;
                html += `<span class="station-cell">${totalCount > 0 ? escapeHtml(stationList) : ''}</span>`;
                html += `</div>`;
                
                // Show variants indented under parent
                if (group.variants.length > 0) {
                    group.variants.forEach(variantSong => {
                        const normalizedVariant = normalizeText(variantSong);
                        // Find matching artist in spinCounts (case-insensitive)
                        const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                        const variantSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedVariant];
                        const variantCount = variantSpins ? Object.values(variantSpins).reduce((sum, count) => sum + count, 0) : 0;
                        const variantStationList = variantSpins ? Object.entries(variantSpins)
                            .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                            .join(', ') : '';
                        
                        html += `<div class="song-count-entry variant-track">`;
                        html += `<span class="song-name-cell" style="padding-left: 20px; color: #718096;">→ ${escapeHtml(variantSong)}</span>`;
                        html += `<span class="count-cell">${variantCount > 0 ? variantCount : ''}</span>`;
                        html += `<span class="station-cell">${variantCount > 0 ? escapeHtml(variantStationList) : ''}</span>`;
                        html += `</div>`;
                    });
                }
            });
            
            // Display standalone songs (not variants, have no variants) - group by normalized name
            const groupedStandaloneSongs = {};
            standaloneSongs.forEach(songName => {
                const normalizedSong = normalizeText(songName);
                if (!groupedStandaloneSongs[normalizedSong]) {
                    groupedStandaloneSongs[normalizedSong] = {
                        displayName: songName, // Use first occurrence as display name
                        aggregatedSpins: {}
                    };
                }
                // Aggregate spins from all case variations
                const normalizedSongKey = normalizeText(songName);
                const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                const songSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedSongKey];
                
                if (songSpins) {
                    Object.entries(songSpins).forEach(([station, count]) => {
                        if (!groupedStandaloneSongs[normalizedSong].aggregatedSpins[station]) {
                            groupedStandaloneSongs[normalizedSong].aggregatedSpins[station] = 0;
                        }
                        groupedStandaloneSongs[normalizedSong].aggregatedSpins[station] += count;
                    });
                }
            });
            
            // Display grouped standalone songs
            Object.entries(groupedStandaloneSongs).forEach(([normalizedKey, group]) => {
                const aggregatedSpins = group.aggregatedSpins;
                const totalCount = Object.values(aggregatedSpins).reduce((sum, count) => sum + count, 0);
                
                if (totalCount > 0) {
                    // Song has spins - show count and stations
                    const stationList = Object.entries(aggregatedSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    
                    html += `<div class="song-count-entry">`;
                    html += `<span class="song-name-cell">${escapeHtml(group.displayName)}</span>`;
                    html += `<span class="count-cell">${totalCount}</span>`;
                    html += `<span class="station-cell">${escapeHtml(stationList)}</span>`;
                    html += `</div>`;
                } else {
                    // Song has no spins - show empty
                    html += `<div class="song-count-entry">`;
                    html += `<span class="song-name-cell">${escapeHtml(group.displayName)}</span>`;
                    html += `<span class="count-cell"></span>`;
                    html += `<span class="station-cell"></span>`;
                    html += `</div>`;
                }
            });
        } else {
            // Artist not in tracklist database - show empty entry
            html += `<div class="song-count-entry">`;
            html += `<span class="song-name-cell">No tracks in database</span>`;
            html += `<span class="count-cell" style="background: #f0f0f0; color: #999;">0</span>`;
            html += `<span class="station-cell" style="color: #ccc;">Add tracks to tracklist database</span>`;
            html += `</div>`;
        }
        
        // Add QC dropdown for tracks found in Excel but not in tracklist
        const foundTracks = getFoundTracksNotInTracklist(artistName, matches, tracklistArtist);
        if (foundTracks.length > 0) {
            html += `<div class="qc-section">`;
            html += `<button class="qc-toggle-btn" onclick="toggleQCDropdown('${escapeHtml(artistName)}')">`;
            html += `🔍 QC: ${foundTracks.length} tracks found in Online Radio Box but not in tracklist (${foundTracks.reduce((sum, t) => sum + t.count, 0)} total spins)`;
            html += `</button>`;
            html += `<div class="qc-dropdown" id="qc-${escapeHtml(artistName)}" style="display: none;">`;
            foundTracks.forEach(track => {
                const stationList = Object.entries(track.stations)
                    .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                    .join(', ');
                html += `<div class="qc-track-entry">`;
                html += `<span class="qc-track-name">${escapeHtml(track.song)}</span>`;
                html += `<span class="qc-track-count">${track.count}</span>`;
                html += `<span class="qc-track-stations">${escapeHtml(stationList)}</span>`;
                html += `<button class="qc-add-btn" onclick="addTrackToDatabase('${escapeHtml(artistName)}', '${escapeHtml(track.song)}')">Add to DB</button>`;
                html += `</div>`;
            });
            html += `</div>`;
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    spingridResultsBody.innerHTML = html;
}

// Copy spingrid format data for Excel
function copySpingridForExcel() {
    // Get the artist list from the input
    const rawArtists = document.getElementById('artistNames').value || '';
    const artistList = rawArtists
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (artistList.length === 0) {
        alert('no artists entered for search.');
        return;
    }
    
    // Group matches by artist and song for spin counts (use normalized keys like display)
    const spinCounts = {};
    matches.forEach(match => {
        if (!spinCounts[match.artist]) {
            spinCounts[match.artist] = {};
        }
        
        // Normalize song name for grouping (case-insensitive)
        const normalizedSong = normalizeText(match.song);
        
        if (!spinCounts[match.artist][normalizedSong]) {
            spinCounts[match.artist][normalizedSong] = {};
        }
        if (!spinCounts[match.artist][normalizedSong][match.station]) {
            spinCounts[match.artist][normalizedSong][match.station] = 0;
        }
        spinCounts[match.artist][normalizedSong][match.station]++;
    });
    
    let excelData = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
        // Add artist header with column labels
        excelData += `\n${artistName.toUpperCase()}\t\t\n`;
        excelData += `Song\tSpins\tStations\n`;
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - group by normalized name to handle duplicates
            const songs = tracklistDatabase[tracklistArtist];
            const tracklistArtistLower = tracklistArtist.toLowerCase();
            
            // Group songs by normalized name (to handle case variations in database)
            const groupedSongs = {};
            songs.forEach(songName => {
                const normalizedSong = normalizeText(songName);
                if (!groupedSongs[normalizedSong]) {
                    groupedSongs[normalizedSong] = {
                        displayName: songName, // Use first occurrence as display name
                        aggregatedSpins: {}
                    };
                }
                
                // Aggregate spins from all case variations
                const matchingArtistKey = Object.keys(spinCounts).find(a => a.toLowerCase() === tracklistArtistLower);
                const songSpins = matchingArtistKey && spinCounts[matchingArtistKey] && spinCounts[matchingArtistKey][normalizedSong];
                
                if (songSpins) {
                    Object.entries(songSpins).forEach(([station, count]) => {
                        if (!groupedSongs[normalizedSong].aggregatedSpins[station]) {
                            groupedSongs[normalizedSong].aggregatedSpins[station] = 0;
                        }
                        groupedSongs[normalizedSong].aggregatedSpins[station] += count;
                    });
                }
            });
            
            // Display grouped songs
            Object.entries(groupedSongs).forEach(([normalizedKey, group]) => {
                const aggregatedSpins = group.aggregatedSpins;
                const totalCount = Object.values(aggregatedSpins).reduce((sum, count) => sum + count, 0);
                
                if (totalCount > 0) {
                    const stationList = Object.entries(aggregatedSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    excelData += `${group.displayName}\t${totalCount}\t${stationList}\n`;
                } else {
                    excelData += `${group.displayName}\t\t\n`;
                }
            });
        } else {
            // Artist not in tracklist database - show empty entry
            excelData += `No tracks in database\t0\tAdd tracks to tracklist database\n`;
        }
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(excelData).then(() => {
        alert('Spingrid data copied to clipboard! Paste into Excel and it will format correctly across columns.');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('failed to copy to clipboard. please try again.');
    });
}

// Set result format and update display
function setResultFormat(format) {
    currentResultFormat = format;
    
    // Update button states
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(format + 'FormatBtn').classList.add('active');
    
    // Hide all formats
    document.querySelectorAll('.result-format').forEach(format => format.style.display = 'none');
    
    // Show selected format
    document.getElementById(format + 'Format').style.display = 'block';
    
    // Redisplay results in new format
    if (matches.length > 0) {
        displayResults(matches);
    }
}


// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function safeCell(row, idx) {
    if (idx == null) return '';
    const v = row[idx];
    return (v === undefined || v === null) ? '' : String(v).trim();
}

// -------------- Fuzzy matching helpers --------------
// Remove "(feat. ...)" and similar patterns from track names
function removeFeatInfo(str) {
    if (!str) return str;
    let cleaned = String(str);
    
    // Remove patterns like "(feat. Artist)", "(feat Artist)", "(ft. Artist)", "(ft Artist)", etc.
    // Also handle variations with different punctuation
    cleaned = cleaned.replace(/\s*\(feat\.?\s+[^)]+\)/gi, ''); // (feat. Artist) or (feat Artist)
    cleaned = cleaned.replace(/\s*\(ft\.?\s+[^)]+\)/gi, ''); // (ft. Artist) or (ft Artist)
    cleaned = cleaned.replace(/\s*\(featuring\s+[^)]+\)/gi, ''); // (featuring Artist)
    cleaned = cleaned.replace(/\s*\(with\s+[^)]+\)/gi, ''); // (with Artist)
    
    // Handle patterns without parentheses
    cleaned = cleaned.replace(/\s+feat\.?\s+[^(]+(?:\s*\(|$)/gi, ''); // feat. Artist (with optional trailing)
    cleaned = cleaned.replace(/\s+ft\.?\s+[^(]+(?:\s*\(|$)/gi, ''); // ft. Artist
    
    return cleaned.trim();
}

function normalizeText(str) {
    if (!str) return '';
    
    // First remove feat information
    str = removeFeatInfo(str);
    
    return String(str)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .replace(/&/g, 'and') // normalize ampersands to 'and'
        .replace(/[^a-z0-9\s]/g, '') // remove punctuation incl. apostrophes
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim();
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
        let prev = i - 1;
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = dp[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[j] = Math.min(
                dp[j] + 1,        // deletion
                dp[j - 1] + 1,    // insertion
                prev + cost       // substitution
            );
            prev = temp;
        }
    }
    return dp[n];
}

function similarityRatio(a, b) {
    const aa = normalizeText(a);
    const bb = normalizeText(b);
    if (!aa && !bb) return 1;
    if (!aa || !bb) return 0;
    const dist = levenshtein(aa, bb);
    const maxLen = Math.max(aa.length, bb.length);
    return 1 - dist / maxLen;
}

function getBestArtistFromList(candidate, artistList) {
    if (!candidate) return null;
    let best = { name: '', score: 0 };
    for (const a of artistList) {
        const s = similarityRatio(candidate, a);
        if (s > best.score) best = { name: a, score: s };
    }
    return best.score > 0 ? best : null;
}

function downloadCSV() {
    if (!matches || matches.length === 0) {
        alert('No matches to download.');
        return;
    }
    const header = ['Station', 'Artist', 'Song'];
    const lines = [header.join(',')];
    for (const m of matches) {
        lines.push([escapeCsv(m.station), escapeCsv(m.artist), escapeCsv(m.song)].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'song_plays_matches.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    const needsQuotes = /[",\n]/.test(value);
    let v = value.replace(/"/g, '""');
    return needsQuotes ? `"${v}"` : v;
}

function resetApp() {
    workbookRef = null;
    headersBySheet = {};
    matches = [];
    document.getElementById('processingSection').style.display = 'none';
    document.getElementById('resultsDisplay').style.display = 'none';
    const summaryEl = document.getElementById('summary');
    if (summaryEl) summaryEl.textContent = '';
}


// Admin helpers
async function adminRefreshStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const el = document.getElementById('adminStatus');
        if (!el) return;
        if (data.exists) {
            const sizeKb = Math.round((data.stats.size / 1024) * 10) / 10;
            const when = new Date(data.stats.mtime).toLocaleString();
            el.textContent = `Stored file: current.xlsx (${sizeKb} KB), updated ${when}`;
            // Auto-load the file if it exists
            loadStoredFile();
        } else {
            el.textContent = 'No file stored on server.';
        }
    } catch (e) {
        const el = document.getElementById('adminStatus');
        if (el) el.textContent = 'Server not reachable. Check deployment status.';
    }
}

async function adminUpload() {
    const password = document.getElementById('adminPassword').value;
    const file = document.getElementById('adminFile').files[0];
    if (!password || !file) { 
        alert('Password and file required.'); 
        return; 
    }
    
    try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'x-admin-password': password },
            body: form
        });
        
        if (!res.ok) {
            if (res.status === 401) {
                alert('Invalid password. Please check your admin password.');
            } else if (res.status === 413) {
                alert('File too large. Please choose a smaller file.');
            } else {
                alert(`Upload failed with error ${res.status}. Please try again.`);
            }
            return;
        }
        
        await adminRefreshStatus();
        alert('File uploaded successfully!');
        // File will be auto-loaded by adminRefreshStatus
    } catch (error) {
        console.error('Upload error:', error);
        alert('Network error during upload. Please check your connection and try again.');
    }
}

async function adminDelete() {
    const password = document.getElementById('adminPassword').value;
    if (!password) { 
        alert('Password required.'); 
        return; 
    }
    
    if (!confirm('Are you sure you want to delete the current file? This action cannot be undone.')) {
        return;
    }
    
    try {
        const res = await fetch('/api/file', {
            method: 'DELETE',
            headers: { 'x-admin-password': password }
        });
        
        if (!res.ok) {
            if (res.status === 401) {
                alert('Invalid password. Please check your admin password.');
            } else {
                alert(`Delete failed with error ${res.status}. Please try again.`);
            }
            return;
        }
        
        await adminRefreshStatus();
        alert('File deleted successfully!');
    } catch (error) {
        console.error('Delete error:', error);
        alert('Network error during delete. Please check your connection and try again.');
    }
}

// Tracklist Database Functions
async function loadTracklistDatabase() {
    try {
        // Try Supabase first if available
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.rpc('get_tracklists_json');
                if (!error && data) {
                    tracklistDatabase = data;
                    console.log('Tracklist loaded from Supabase');
                    // Backup to localStorage
                    localStorage.setItem('tracklistDatabase', JSON.stringify(tracklistDatabase));
                    return;
                }
            } catch (supabaseError) {
                console.warn('Supabase fetch failed, trying API fallback:', supabaseError);
            }
        }
        
        // Fallback to REST API
        const response = await fetch('/api/tracklist');
        if (response.ok) {
            tracklistDatabase = await response.json();
            console.log('Tracklist loaded from API');
            // Backup to localStorage
            localStorage.setItem('tracklistDatabase', JSON.stringify(tracklistDatabase));
        } else {
            // Fallback to localStorage if server fails
            const stored = localStorage.getItem('tracklistDatabase');
            if (stored) {
                tracklistDatabase = JSON.parse(stored);
                console.log('Tracklist loaded from localStorage (server unavailable)');
            }
        }
    } catch (e) {
        console.error('Error loading tracklist database:', e);
        // Fallback to localStorage
        const stored = localStorage.getItem('tracklistDatabase');
        if (stored) {
            try {
                tracklistDatabase = JSON.parse(stored);
                console.log('Tracklist loaded from localStorage (error fallback)');
            } catch (parseError) {
                console.error('Error parsing localStorage tracklist:', parseError);
                tracklistDatabase = {};
            }
        }
    }
}

async function saveTracklistDatabase() {
    try {
        // Always save to localStorage as backup
        localStorage.setItem('tracklistDatabase', JSON.stringify(tracklistDatabase));
        
        // Try Supabase direct client first if available
        if (supabaseClient) {
            try {
                // Convert to rows for Supabase
                const rows = [];
                for (const [artist, songs] of Object.entries(tracklistDatabase)) {
                    for (const song of songs) {
                        rows.push({
                            artist_name: artist,
                            song_name: song
                        });
                    }
                }
                
                if (rows.length > 0) {
                    // Delete all existing and insert new ones
                    const { error: deleteError } = await supabaseClient
                        .from('tracklists')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000');
                    
                    if (deleteError) {
                        console.warn('Supabase delete warning:', deleteError);
                    }
                    
                    const { error: insertError } = await supabaseClient
                        .from('tracklists')
                        .insert(rows);
                    
                    if (!insertError) {
                        console.log('Tracklist saved to Supabase');
                        return;
                    } else {
                        console.warn('Supabase insert failed, trying API fallback:', insertError);
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabase save failed, trying API fallback:', supabaseError);
            }
        }
        
        // Fallback to REST API
        const response = await fetch('/api/tracklist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tracklistDatabase)
        });
        
        if (response.ok) {
            console.log('Tracklist saved to API');
        } else {
            console.error('Failed to save tracklist to API');
        }
    } catch (e) {
        console.error('Error saving tracklist database:', e);
    }
}

function addSongToTracklist() {
    const artistName = document.getElementById('artistName').value.trim();
    const songName = document.getElementById('songName').value.trim();
    
    if (!artistName || !songName) {
        alert('Please enter both artist name and song name.');
        return;
    }
    
    if (!tracklistDatabase[artistName]) {
        tracklistDatabase[artistName] = [];
    }
    
    // Check if song already exists
    if (tracklistDatabase[artistName].includes(songName)) {
        alert('This song is already in the tracklist for this artist.');
        return;
    }
    
    tracklistDatabase[artistName].push(songName);
    // Keep songs in the order they're added (no sorting)
    
    saveTracklistDatabase();
    displayTracklists();
    
    // Clear inputs
    document.getElementById('artistName').value = '';
    document.getElementById('songName').value = '';
}

function addMultipleSongs() {
    const artistName = document.getElementById('bulkArtistName').value.trim();
    const songNames = document.getElementById('bulkSongNames').value.trim();
    
    if (!artistName || !songNames) {
        alert('Please enter artist name and song names.');
        return;
    }
    
    const songs = songNames.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (songs.length === 0) {
        alert('Please enter at least one song name.');
        return;
    }
    
    if (!tracklistDatabase[artistName]) {
        tracklistDatabase[artistName] = [];
    }
    
    let addedCount = 0;
    let duplicateCount = 0;
    
    songs.forEach(song => {
        if (!tracklistDatabase[artistName].includes(song)) {
            tracklistDatabase[artistName].push(song);
            addedCount++;
        } else {
            duplicateCount++;
        }
    });
    
    if (addedCount > 0) {
        // Keep songs in the order they're added (no sorting)
        saveTracklistDatabase();
        displayTracklists();
        
        let message = `Added ${addedCount} new songs to ${artistName}'s tracklist.`;
        if (duplicateCount > 0) {
            message += ` (${duplicateCount} songs were already in the tracklist)`;
        }
        alert(message);
    } else {
        alert('All songs were already in the tracklist.');
    }
    
    // Clear bulk inputs
    document.getElementById('bulkArtistName').value = '';
    document.getElementById('bulkSongNames').value = '';
}


function removeSongFromTracklist(artistName, songName) {
    if (tracklistDatabase[artistName]) {
        const index = tracklistDatabase[artistName].indexOf(songName);
        if (index > -1) {
            tracklistDatabase[artistName].splice(index, 1);
            
            // Remove artist if no songs left
            if (tracklistDatabase[artistName].length === 0) {
                delete tracklistDatabase[artistName];
            }
            
            // Persist full replacement to server so deletions are honored
            saveTracklistDatabase();
            displayTracklists();
        }
    }
}

function deleteArtistTracklist(artistName) {
    if (!tracklistDatabase[artistName]) {
        alert('No tracklist found for this artist.');
        return;
    }
    
    const songCount = tracklistDatabase[artistName].length;
    if (confirm(`Are you sure you want to delete the entire tracklist for "${artistName}"? This will remove ${songCount} songs and cannot be undone.`)) {
        delete tracklistDatabase[artistName];
        saveTracklistDatabase();
        displayTracklists();
        alert(`Deleted entire tracklist for "${artistName}" (${songCount} songs removed).`);
    }
}


function displayTracklists() {
    const container = document.getElementById('tracklistContainer');
    
    if (Object.keys(tracklistDatabase).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No tracklists added yet. Add some songs to get started!</p>';
        return;
    }
    
    let html = '';
    Object.keys(tracklistDatabase).sort().forEach(artistName => {
        const songs = tracklistDatabase[artistName];
        html += `
            <div class="artist-group">
                <div class="artist-header">
                    <span class="artist-name">${escapeHtml(artistName)}</span>
                    <span class="artist-count">${songs.length} songs</span>
                    <button class="delete-artist-btn" onclick="deleteArtistTracklist('${escapeHtml(artistName)}')" title="Delete entire tracklist for this artist">Delete All</button>
                </div>
                <div class="songs-list">
        `;
        
        songs.forEach(songName => {
            html += `
                <div class="song-item">
                    <span class="song-name">${escapeHtml(songName)}</span>
                    <button class="remove-song" onclick="removeSongFromTracklist('${escapeHtml(artistName)}', '${escapeHtml(songName)}')">Remove</button>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Filter tracklists by artist name
function filterTracklists() {
    const searchInput = document.getElementById('tracklistSearch');
    if (!searchInput) {
        console.error('Search input not found');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    const artistGroups = document.querySelectorAll('.artist-group');
    
    console.log('Filtering with term:', searchTerm, 'Found groups:', artistGroups.length);
    
    artistGroups.forEach(group => {
        const artistNameElement = group.querySelector('.artist-name');
        if (!artistNameElement) {
            console.error('Artist name element not found in group');
            return;
        }
        
        const artistName = artistNameElement.textContent.toLowerCase();
        
        if (artistName.includes(searchTerm)) {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
        }
    });
}

// Clear tracklist search
function clearTracklistSearch() {
    document.getElementById('tracklistSearch').value = '';
    filterTracklists(); // Show all artists again
}

function exportTracklists() {
    if (Object.keys(tracklistDatabase).length === 0) {
        alert('No tracklists to export.');
        return;
    }
    
    const dataStr = JSON.stringify(tracklistDatabase, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tracklist-database.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importTracklists() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (typeof importedData !== 'object' || importedData === null) {
                throw new Error('Invalid file format');
            }
            
            if (confirm('This will replace your current tracklist database. Continue?')) {
                tracklistDatabase = importedData;
                saveTracklistDatabase();
                displayTracklists();
                alert('Tracklist database imported successfully!');
            }
        } catch (error) {
            alert('Error importing file. Please make sure it\'s a valid JSON file.');
            console.error('Import error:', error);
        }
    };
    
    reader.readAsText(file);
    fileInput.value = ''; // Reset file input
}

// Check if a song is in the tracklist database
function isSongInTracklist(artistName, songName) {
    if (!tracklistDatabase[artistName]) {
        return false;
    }
    
    // Normalize both song name and database songs by removing feat info
    const normalizedSongName = removeFeatInfo(songName).toLowerCase().trim();
    
    // Check for exact match first
    if (tracklistDatabase[artistName].includes(songName)) {
        return true;
    }
    
    // Check for case-insensitive match
    const lowerSongName = songName.toLowerCase();
    const exactMatch = tracklistDatabase[artistName].some(song => 
        song.toLowerCase() === lowerSongName
    );
    if (exactMatch) return true;
    
    // Check for match after removing feat info
    return tracklistDatabase[artistName].some(song => {
        const normalizedDbSong = removeFeatInfo(song).toLowerCase().trim();
        return normalizedDbSong === normalizedSongName;
    });
}

// Fuzzy version that tolerates typos/apostrophes (90% threshold)
function isSongInTracklistFuzzy(artistName, songName) {
    // Find matching artist key in DB (case-insensitive, fuzzy)
    const artistKeys = Object.keys(tracklistDatabase);
    let bestArtist = null;
    let bestScore = 0;
    artistKeys.forEach(k => {
        const s = similarityRatio(k, artistName);
        if (s > bestScore) { bestScore = s; bestArtist = k; }
    });
    if (!bestArtist || bestScore < FUZZY_THRESHOLD) return false;
    const songs = tracklistDatabase[bestArtist] || [];
    // Exact, containment, or fuzzy song match
    for (const s of songs) {
        const a = normalizeText(s);
        const b = normalizeText(songName);
        if (a === b) return true;
        if (a && b && (a.includes(b) || b.includes(a))) return true;
        const score = similarityRatio(a, b);
        if (score >= FUZZY_THRESHOLD) return true;
    }
    return false;
}

// Return best canonical match from tracklist DB, not just boolean
function matchTracklistFuzzy(artistName, songName) {
    const artistKeys = Object.keys(tracklistDatabase);
    let bestArtistKey = null;
    let bestArtistScore = 0;
    artistKeys.forEach(k => {
        const s = similarityRatio(k, artistName);
        if (s > bestArtistScore) { bestArtistScore = s; bestArtistKey = k; }
    });
    if (!bestArtistKey || bestArtistScore < FUZZY_THRESHOLD) return { ok: false };
    const songs = tracklistDatabase[bestArtistKey] || [];
    let bestSong = null;
    let bestSongScore = 0;
    const bNorm = normalizeText(songName);
    for (const s of songs) {
        const aNorm = normalizeText(s);
        if (aNorm === bNorm) return { ok: true, artist: bestArtistKey, song: s };
        if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return { ok: true, artist: bestArtistKey, song: s };
        const score = similarityRatio(aNorm, bNorm);
        if (score > bestSongScore) { bestSongScore = score; bestSong = s; }
    }
    if (bestSong && bestSongScore >= FUZZY_THRESHOLD) return { ok: true, artist: bestArtistKey, song: bestSong };
    return { ok: false };
}

// Get tracks found in Online Radio Box but not in tracklist for QC
function getFoundTracksNotInTracklist(artistName, matches, tracklistArtist) {
    const artistMatches = matches.filter(m => m.artist.toLowerCase() === artistName.toLowerCase());
    const foundTracks = {};
    
    artistMatches.forEach(match => {
        if (!foundTracks[match.song]) {
            foundTracks[match.song] = { song: match.song, count: 0, stations: {} };
        }
        foundTracks[match.song].count++;
        if (!foundTracks[match.song].stations[match.station]) {
            foundTracks[match.song].stations[match.station] = 0;
        }
        foundTracks[match.song].stations[match.station]++;
    });
    
    // Filter out tracks that are already in tracklist
    const tracklistSongs = tracklistArtist ? tracklistDatabase[tracklistArtist] : [];
    return Object.values(foundTracks).filter(track => {
        return !tracklistSongs.some(dbSong => {
            const dbNorm = normalizeText(dbSong);
            const trackNorm = normalizeText(track.song);
            return dbNorm === trackNorm || dbNorm.includes(trackNorm) || trackNorm.includes(dbNorm);
        });
    });
}

// Toggle QC dropdown
function toggleQCDropdown(artistName) {
    const dropdown = document.getElementById(`qc-${artistName}`);
    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

// Add track to database from QC dropdown
function addTrackToDatabase(artistName, songName) {
    if (!tracklistDatabase[artistName]) {
        tracklistDatabase[artistName] = [];
    }
    
    if (tracklistDatabase[artistName].includes(songName)) {
        alert('This song is already in the tracklist for this artist.');
        return;
    }
    
    tracklistDatabase[artistName].push(songName);
    saveTracklistDatabase();
    displayTracklists();
    
    // Refresh the spingrid display to update QC section
    displayResults(matches);
    
    alert(`Added "${songName}" to ${artistName}'s tracklist!`);
}

// Modal Functions
function openAdminModal() {
    document.getElementById('adminModal').style.display = 'block';
    adminRefreshStatus(); // Refresh status when opening
}

function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
}

function openTracklistModal() {
    document.getElementById('tracklistModal').style.display = 'block';
    displayTracklists(); // Refresh tracklist display when opening
    // Clear search when opening modal
    const searchInput = document.getElementById('tracklistSearch');
    if (searchInput) {
        searchInput.value = '';
        console.log('Search input found and cleared');
    } else {
        console.error('Search input not found in modal');
    }
}

function closeTracklistModal() {
    document.getElementById('tracklistModal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const adminModal = document.getElementById('adminModal');
    const tracklistModal = document.getElementById('tracklistModal');
    
    if (event.target === adminModal) {
        closeAdminModal();
    }
    if (event.target === tracklistModal) {
        closeTracklistModal();
    }
    if (event.target === document.getElementById('variantModal')) {
        closeVariantModal();
    }
}

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAdminModal();
        closeTracklistModal();
        closeVariantModal();
    }
});

// Track Variant Functions
let currentVariantArtist = '';
let currentVariantSong = '';
let selectedParentSong = null;

async function loadTrackVariants() {
    try {
        // Try Supabase first if available
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('track_variants')
                    .select('*');
                if (!error && data) {
                    trackVariants = {};
                    data.forEach(row => {
                        const key = `${row.artist_name}|${row.variant_song}`;
                        trackVariants[key] = row.parent_song;
                    });
                    console.log('Track variants loaded from Supabase');
                    // Backup to localStorage
                    localStorage.setItem('trackVariants', JSON.stringify(trackVariants));
                    return;
                }
            } catch (supabaseError) {
                console.warn('Supabase fetch failed, trying localStorage:', supabaseError);
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('trackVariants');
        if (stored) {
            trackVariants = JSON.parse(stored);
            console.log('Track variants loaded from localStorage');
        }
    } catch (e) {
        console.error('Error loading track variants:', e);
        trackVariants = {};
    }
}

async function saveTrackVariants() {
    try {
        // Always save to localStorage as backup
        localStorage.setItem('trackVariants', JSON.stringify(trackVariants));
        
        // Try Supabase direct client first if available
        if (supabaseClient) {
            try {
                // Convert to rows for Supabase
                const rows = [];
                for (const [key, parentSong] of Object.entries(trackVariants)) {
                    const [artistName, variantSong] = key.split('|');
                    rows.push({
                        artist_name: artistName,
                        variant_song: variantSong,
                        parent_song: parentSong
                    });
                }
                
                if (rows.length > 0) {
                    // Delete all existing and insert new ones
                    const { error: deleteError } = await supabaseClient
                        .from('track_variants')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000');
                    
                    if (deleteError) {
                        console.warn('Supabase delete warning:', deleteError);
                    }
                    
                    const { error: insertError } = await supabaseClient
                        .from('track_variants')
                        .insert(rows);
                    
                    if (!insertError) {
                        console.log('Track variants saved to Supabase');
                        return;
                    } else {
                        console.warn('Supabase insert failed:', insertError);
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabase save failed:', supabaseError);
            }
        }
    } catch (e) {
        console.error('Error saving track variants:', e);
    }
}

function openVariantModal(artist, song) {
    currentVariantArtist = artist;
    currentVariantSong = song;
    
    // Check if already a variant
    const variantKey = `${artist}|${song}`;
    selectedParentSong = trackVariants[variantKey] || null;
    
    // Update info text
    document.getElementById('variantTrackInfo').textContent = `${artist} - ${song}`;
    
    // Display tracklist for this artist
    displayVariantTracklist(artist);
    
    // Show modal
    document.getElementById('variantModal').style.display = 'block';
}

function closeVariantModal() {
    document.getElementById('variantModal').style.display = 'none';
    currentVariantArtist = '';
    currentVariantSong = '';
    selectedParentSong = null;
}

function displayVariantTracklist(artistName) {
    const container = document.getElementById('variantTracklistContainer');
    
    // Find matching artist in tracklist database (case-insensitive)
    const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
        artist.toLowerCase() === artistName.toLowerCase()
    );
    
    if (!tracklistArtist || !tracklistDatabase[tracklistArtist] || tracklistDatabase[tracklistArtist].length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No tracks found for this artist in the tracklist database. Please add tracks first.</p>';
        return;
    }
    
    const songs = tracklistDatabase[tracklistArtist];
    let html = '<div class="variant-tracklist-list">';
    
    songs.forEach(songName => {
        const isSelected = selectedParentSong === songName;
        const variantKey = `${tracklistArtist}|${songName}`;
        const hasVariants = Object.entries(trackVariants).some(([key, parent]) => 
            parent === songName && key !== variantKey
        );
        
        html += `<div class="variant-track-item ${isSelected ? 'selected' : ''}" onclick="selectParentTrack('${escapeHtml(tracklistArtist)}', '${escapeHtml(songName)}')">`;
        html += `<div class="variant-track-name">${escapeHtml(songName)}</div>`;
        if (hasVariants) {
            const variantCount = Object.values(trackVariants).filter(p => p === songName).length;
            html += `<div class="variant-indicator">${variantCount} variant(s)</div>`;
        }
        html += `</div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function selectParentTrack(artist, song) {
    selectedParentSong = song;
    displayVariantTracklist(artist);
}

function clearVariant() {
    selectedParentSong = null;
    displayVariantTracklist(currentVariantArtist);
}

function saveVariant() {
    const variantKey = `${currentVariantArtist}|${currentVariantSong}`;
    
    if (!selectedParentSong) {
        // Clear variant relationship
        delete trackVariants[variantKey];
        saveTrackVariants();
        
        // Refresh displays
        displayTableFormat(matches);
        if (currentResultFormat === 'spingrid') {
            displayResults(matches);
        }
        
        closeVariantModal();
        return;
    }
    
    // Can't be a variant of itself
    if (currentVariantSong === selectedParentSong) {
        alert('A track cannot be a variant of itself.');
        return;
    }
    
    trackVariants[variantKey] = selectedParentSong;
    saveTrackVariants();
    
    // Refresh the table display to show the variant indicator
    displayTableFormat(matches);
    
    closeVariantModal();
    
    // If we're currently viewing spingrid, refresh it
    if (currentResultFormat === 'spingrid') {
        displayResults(matches);
    }
}

// Helper function to get parent song for a variant (or return the song itself if not a variant)
function getParentSong(artist, song) {
    const variantKey = `${artist}|${song}`;
    return trackVariants[variantKey] || song;
}
