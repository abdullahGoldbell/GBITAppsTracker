#!/bin/bash
# HRIQ Daily Scraper - Runs at 8 AM SGT
# Scrapes leave data and pushes to GitHub

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "$(date): Starting HRIQ scraper..."

# Pull latest changes
git pull origin main

# Run scraper
npm run scrape

# Check if there are changes
if git diff --quiet website/data/leaves.json; then
    echo "$(date): No changes to leave data"
    exit 0
fi

# Commit and push
git add website/data/leaves.json
git commit -m "Auto-update leave data - $(date +'%Y-%m-%d %H:%M')

Co-Authored-By: HRIQ Scraper Bot <scraper@hriq.local>"

git push origin main

echo "$(date): Successfully updated and pushed leave data"
