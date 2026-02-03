# Team Leave Calendar

A leave calendar display for the GROUP IT Department.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Sync data:**
   ```bash
   npm run scrape
   ```

4. **View the calendar:**
   ```bash
   npm run serve
   # Open http://localhost:3000
   ```

## Features

- Monthly calendar view
- Color-coded leave types
- Public holiday display
- Click to see full day details
- Keyboard navigation (← →)
- Responsive design
