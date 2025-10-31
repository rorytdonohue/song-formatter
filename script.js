// Global variables
let workbookRef = null; // keep workbook to scan all sheets
let headersBySheet = {}; // cache headers per sheet
let matches = []; // { station, artist, song }
let spinitronMatches = []; // Spinitron data matches
let onlineradioboxMatches = []; // Online Radio Box data matches
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

// Handle Spinitron upload for Spinitron formatter
function handleCsvUpload() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    // Clear previous data when uploading a new file
    spinitronMatches = [];
    onlineradioboxMatches = [];
    matches = [];
    
    // Clear results display
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
        resultsDisplay.innerHTML = '';
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            const csvData = parseCSV(csvText);
            
            if (csvData.length === 0) {
                alert('Spinitron file appears to be empty.');
                return;
            }
            
            // Process the Spinitron data and show results
            processCsvData(csvData);
            
        } catch (error) {
            console.error('Error reading Spinitron:', error);
            alert('Error reading Spinitron file. Please make sure it\'s a valid CSV file.');
        }
    };
    
    reader.readAsText(file);
}

// Parse CSV text into array of objects
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
    }
    
    return data;
}

// Process Spinitron data and display results
function processCsvData(csvData) {
    // Convert Spinitron data to matches format
    matches = [];
    
    csvData.forEach(row => {
        // Try to extract station, artist, and song from various possible column names
        const station = row['Station'] || row['station'] || row['Show'] || row['show'] || 'Unknown';
        const artist = row['Artist'] || row['artist'] || row['Performer'] || row['performer'] || '';
        const song = row['Song'] || row['song'] || row['Title'] || row['title'] || '';
        
        if (song) {
            // If no artist column, we'll need to prompt user for artist name
            if (artist) {
                matches.push({ station, artist, song });
            } else {
                // Store without artist for now - we'll handle this case
                matches.push({ station, artist: '', song });
            }
        }
    });
    
    if (matches.length === 0) {
        alert('No valid spin data found in Spinitron. Please check that your Spinitron file has columns for Station and Song.');
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
    
    // Show the results display
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.style.display = 'block';
    
    // Keep the load section visible so user can upload a new file to replace this one
    // Don't hide it - just keep it available for new uploads
    
    // Set up the artist names input with found artists
    setupCsvArtistInput(foundArtists);
    
    // Add Find Matches button for Online Radio Box data
    addFindMatchesButton();
    
    // Display Spinitron results in current format
    displayResults(matches);
    
    // Update summary
    const summaryEl = document.getElementById('summary');
    if (summaryEl) {
        summaryEl.textContent = `${matches.length} spins loaded from Spinitron file. Found ${foundArtists.length} artists: ${foundArtists.join(', ')}. Click "Find Matches" to search Online Radio Box file.`;
    }
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
        html += `<div class="artist-section"><div class="artist-header">${escapeHtml(artistName.toUpperCase())}</div>`;
        
        if (tracklistArtist && tracklistDatabase[tracklistArtist].length > 0) {
            // Artist has tracks in database - show all their songs
            const songs = tracklistDatabase[tracklistArtist];
            
            // Group variants under their parent tracks (same logic as main displaySpingridFormat)
            const parentGroups = {};
            const standaloneSongs = [];
            
            songs.forEach(songName => {
                const variantKey = `${tracklistArtist}|${songName}`;
                const isVariant = trackVariants[variantKey];
                
                if (isVariant) {
                    return;
                }
                
                // Check if this song is a parent (has variants pointing to it for this artist)
                const hasVariants = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist] = key.split('|');
                    return variantArtist === tracklistArtist && parent === songName;
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
                        if (variantArtist === tracklistArtist && parent === songName) {
                            const [, variantSong] = key.split('|');
                            if (variantSong) {
                                parentGroups[songName].variants.push(variantSong);
                                const variantSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][variantSong];
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
                    
                    const parentSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][songName];
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
                        const variantSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][variantSong];
                        const variantCount = variantSpins ? Object.values(variantSpins).reduce((sum, count) => sum + count, 0) : 0;
                        const variantStationList = variantSpins ? Object.entries(variantSpins)
                            .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                            .join(', ') : '';
                        
                        html += `<div class="song-count-entry variant-track"><span class="song-name-cell" style="padding-left: 20px; color: #718096;">→ ${escapeHtml(variantSong)}</span><span class="count-cell">${variantCount > 0 ? variantCount : ''}</span><span class="station-cell">${variantCount > 0 ? escapeHtml(variantStationList) : ''}</span></div>`;
                    });
                }
            });
            
            // Display standalone songs
            standaloneSongs.forEach(songName => {
                const songSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][songName];
                
                if (songSpins) {
                    const totalCount = Object.values(songSpins).reduce((sum, count) => sum + count, 0);
                    const stationList = Object.entries(songSpins)
                        .map(([station, count]) => count > 1 ? `${station} (${count})` : station)
                        .join(', ');
                    
                    html += `<div class="song-count-entry"><span class="song-name-cell">${escapeHtml(songName)}</span><span class="count-cell">${totalCount}</span><span class="station-cell">${escapeHtml(stationList)}</span></div>`;
                } else {
                    html += `<div class="song-count-entry"><span class="song-name-cell">${escapeHtml(songName)}</span><span class="count-cell"></span><span class="station-cell"></span></div>`;
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
    
    // Group matches by artist and song for spin counts
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
    
    let excelData = '';
    
    // Process each artist from the search list (in order)
    artistList.forEach(artistName => {
        const artistLower = artistName.toLowerCase();
        
        // Find matching artist in tracklist database (case-insensitive)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === artistLower
        );
        
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
                    
                    excelData += `${songName}\t${totalCount}\t${stationList}\n`;
                } else {
                    // Song has no spins - show empty
                    excelData += `${songName}\t\t\n`;
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
    
    downloadBtn.disabled = matches.length === 0;
    findBtn.disabled = false;
    findBtn.innerHTML = 'Find Matches';
    findBtn.classList.remove('loading');
    progressEl.textContent = '';
    const summaryEl = document.getElementById('summary');
    summaryEl.textContent = `${matches.length} matches found across ${summary.sheetsScanned} sheets (${summary.rowsScanned} rows scanned).`;
    
    // Display results in current format
    displayResults(sortedMatches);
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
        const variantKey = `${match.artist}|${match.song}`;
        const isVariant = trackVariants[variantKey];
        const variantIndicator = isVariant ? ` <span style="color: #718096; font-size: 0.85em;">(variant of ${escapeHtml(isVariant)})</span>` : '';
        
        // Check if this track is in the tracklist database (recognized in spingrid)
        const tracklistArtist = Object.keys(tracklistDatabase).find(artist => 
            artist.toLowerCase() === match.artist.toLowerCase()
        );
        const isInTracklist = tracklistArtist && tracklistDatabase[tracklistArtist] && 
            isSongInTracklistFuzzy(tracklistArtist, match.song);
        
        // Only show "make variant" button if track is NOT in tracklist database
        const variantButton = !isInTracklist ? `
            <button class="variant-btn" onclick="openVariantModal('${escapeHtml(match.artist)}', '${escapeHtml(match.song)}')" title="Make this track a variant of another track">
                make variant
            </button>
        ` : '<span style="color: #718096; font-size: 0.85em;">in tracklist</span>';
        
        row.innerHTML = `
            <td>${escapeHtml(match.station)}</td>
            <td>${escapeHtml(match.artist)}</td>
            <td>${escapeHtml(match.song)}${variantIndicator}</td>
            <td>${variantButton}</td>
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
            
            // Group variants under their parent tracks
            const parentGroups = {}; // { parentSong: { variants: [...], spins: {...} } }
            const standaloneSongs = []; // Songs that are not variants and have no variants
            
            songs.forEach(songName => {
                // Check if this song is itself a variant
                const variantKey = `${tracklistArtist}|${songName}`;
                const isVariant = trackVariants[variantKey];
                
                if (isVariant) {
                    // This is a variant - skip it here, will be shown under parent
                    return;
                }
                
                // Check if this song is a parent (has variants pointing to it for this artist)
                const hasVariants = Object.entries(trackVariants).some(([key, parent]) => {
                    const [variantArtist] = key.split('|');
                    return variantArtist === tracklistArtist && parent === songName;
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
                        if (variantArtist === tracklistArtist && parent === songName) {
                            const [, variantSong] = key.split('|');
                            if (variantSong) {
                                parentGroups[songName].variants.push(variantSong);
                                
                                // Aggregate spins from variant tracks
                                const variantSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][variantSong];
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
                    
                    // Also add spins from the parent track itself
                    const parentSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][songName];
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
                        const variantSpins = spinCounts[tracklistArtist] && spinCounts[tracklistArtist][variantSong];
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
            
            // Display standalone songs (not variants, have no variants)
            standaloneSongs.forEach(songName => {
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
                    
                    // Format: Song Name | Spin Count | Station List (horizontal layout)
                    excelData += `${songName}\t${totalCount}\t${stationList}\n`;
                } else {
                    // Song has no spins - show empty
                    excelData += `${songName}\t\t\n`;
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
