#!/bin/bash
# HRIQ Daily Scraper - Runs at 8 AM SGT
# Scrapes leave data and pushes to GitHub

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Set up environment for LaunchDaemon context
export HOME="/Users/abdullahsarfaraz"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Configure SSH to use the deploy key (no agent needed)
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"

echo "$(date): Starting HRIQ scraper..."

# Pull latest changes
git pull origin main

# Run scraper
npm run scrape

# Check if there are changes to any data files
if git diff --quiet website/data/ && [ -z "$(git ls-files --others --exclude-standard website/data/)" ]; then
    echo "$(date): No changes to leave data"
    exit 0
fi

# Commit and push all data files
git add website/data/
git commit -m "Auto-update leave data - $(date +'%Y-%m-%d %H:%M')

Co-Authored-By: HRIQ Scraper Bot <scraper@hriq.local>"

git push origin main

echo "$(date): Successfully updated and pushed leave data"
