# 🎵 Song Play Formatter

A web application that processes Excel files containing song play data and formats them by radio station, artist, and song name.

## Features

- **Excel File Upload**: Drag and drop or click to upload Excel files (.xlsx, .xls)
- **Column Mapping**: Map your Excel columns to Radio Station, Artist, and Song
- **Artist Selection**: Choose which artists to include in the formatted results
- **Smart Grouping**: Automatically groups songs by radio station
- **Play Count**: Shows how many times each song was played
- **Export Results**: Download formatted results as a new Excel file
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. **Open the Application**
   - Open `index.html` in your web browser
   - No installation required - runs entirely in the browser

2. **Upload Your Excel File**
   - Drag and drop your Excel file onto the upload area, or
   - Click "Choose File" to browse and select your file

3. **Map Your Columns**
   - Select which column contains Radio Station data
   - Select which column contains Artist data  
   - Select which column contains Song data
   - Click "Process Data"

4. **Select Artists**
   - Choose which artists you want to include in the results
   - Use the search box to filter artists
   - Use "Select All" or "Deselect All" for quick selection
   - Click "Format Results"

5. **View and Download Results**
   - Results are organized by radio station
   - Each song shows the artist, song name, and play count
   - Click "Download as Excel" to save the formatted results
   - Click "Start Over" to process a new file

## Excel File Format

Your Excel file should have columns for:
- **Radio Station**: The name of the radio station
- **Artist**: The name of the artist/band
- **Song**: The name of the song

Additional columns (like Date, Time, etc.) are ignored during processing.

### Sample Data Format

| Radio Station | Artist | Song | Date | Time |
|---------------|--------|------|------|------|
| KISS FM | Taylor Swift | Shake It Off | 2024-01-15 | 14:30 |
| ROCK 101 | AC/DC | Thunderstruck | 2024-01-15 | 18:00 |
| HOT 97 | Drake | God's Plan | 2024-01-15 | 20:00 |

## Technical Details

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Excel Processing**: SheetJS library
- **No Backend Required**: Runs entirely in the browser
- **File Size**: Handles files up to browser memory limits
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## File Structure

```
song-formatter/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
├── sample_data.xlsx    # Sample Excel file for testing
└── README.md           # This file
```

## Privacy & Security

- **No Data Upload**: All processing happens locally in your browser
- **No Server Required**: No data is sent to external servers
- **Secure**: Your Excel files never leave your computer

## Troubleshooting

**File won't upload?**
- Make sure it's a valid Excel file (.xlsx or .xls)
- Check that the file isn't corrupted
- Try a smaller file if it's very large

**No data showing after processing?**
- Verify your column selections are correct
- Check that your data has values in all three required columns
- Make sure there are no empty rows in your data

**Results look wrong?**
- Double-check your column mapping
- Verify the data in your Excel file is clean and consistent
- Try selecting different artists to see if that helps

## Sample Data

A sample Excel file (`sample_data.xlsx`) is included to test the application. It contains sample radio play data that you can use to see how the formatter works.

## Support

This is a standalone web application that doesn't require any external dependencies or server setup. Simply open `index.html` in your web browser to get started!
