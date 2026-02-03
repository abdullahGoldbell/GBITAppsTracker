# HRIQ Leave Calendar

A web scraper and display website for the HRIQ Leave Calendar (GROUP IT Department).

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure credentials:**
   ```bash
   cp .env.example .env
   # Edit .env with your HRIQ credentials
   ```

3. **Run the scraper:**
   ```bash
   npm run scrape
   ```

4. **View the calendar:**
   ```bash
   npm run serve
   # Open http://localhost:3000
   ```

## Scheduled Scraping

To run the scraper daily, add a cron job:

```bash
# Edit crontab
crontab -e

# Add this line to run at 7 AM daily
0 7 * * * cd /Users/abdullah/Desktop/Abdullah\ AI\ Stuff/HRIQ && /usr/local/bin/npm run scrape >> /tmp/hriq-scrape.log 2>&1
```

## Project Structure

```
HRIQ/
├── scraper/
│   └── index.js       # Puppeteer scraper
├── website/
│   ├── index.html     # Calendar display
│   ├── styles.css     # Styling
│   └── app.js         # Calendar logic
├── data/
│   └── leaves.json    # Scraped data
├── .env               # Credentials (not committed)
├── .env.example       # Credential template
└── package.json
```

## Features

- Monthly calendar view
- Color-coded leave types
- Public holiday display
- Click to see full day details
- Keyboard navigation (← →)
- Responsive design
