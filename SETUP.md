# HRIQ Leave Calendar - Mac Mini Setup Guide

This guide explains how to set up the HRIQ Leave Calendar scraper on a Mac Mini for automated daily updates.

## Prerequisites

- macOS (tested on Monterey and later)
- Node.js 18+ installed
- Git installed and configured
- Network access to `essportal.goldbell.com.sg`

## Quick Setup

### 1. Clone the Repository

```bash
cd ~
git clone https://github.com/abdullahGoldbell/GBITAppsTracker.git
cd GBITAppsTracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Credentials

Create a `.env` file with your HR portal credentials:

```bash
cat > .env << 'EOF'
HRIQ_USER_ID=your_user_id
HRIQ_PASSWORD=your_password
EOF

# Secure the file
chmod 600 .env
```

### 4. Test the Scraper

```bash
npm run scrape
```

You should see output like:
```
🚀 Starting HRIQ Leave Calendar Scraper...
🔐 Logging in...
✅ Login successful!
...
✅ Data saved to website/data/leaves.json
```

### 5. Configure Git for Auto-Push

```bash
git config user.email "scraper@office.local"
git config user.name "HRIQ Scraper Bot"
```

Ensure Git can push without prompting for credentials:
- Use SSH key authentication, OR
- Use HTTPS with credential helper: `git config --global credential.helper osxkeychain`

### 6. Install the LaunchAgent (Auto-run at 8 AM)

```bash
# Copy the LaunchAgent plist
cp ~/GBITAppsTracker/docs/com.hriq.scraper.plist ~/Library/LaunchAgents/

# Edit the plist to update paths if needed
nano ~/Library/LaunchAgents/com.hriq.scraper.plist

# Load the LaunchAgent
launchctl load ~/Library/LaunchAgents/com.hriq.scraper.plist

# Verify it's loaded
launchctl list | grep hriq
```

### 7. (Optional) Install Webhook Server for Remote Refresh

To allow the website's refresh button to trigger scraping:

```bash
# Install PM2 for process management
npm install -g pm2

# Start the webhook server
cd ~/GBITAppsTracker
pm2 start scripts/webhook-server.js --name hriq-webhook

# Make it start on boot
pm2 startup
pm2 save
```

Configure your router to forward port 3847 to the Mac Mini, or use ngrok/Tailscale for secure access.

---

## File Locations

| File | Purpose |
|------|---------|
| `~/GBITAppsTracker/.env` | HR portal credentials |
| `~/GBITAppsTracker/scripts/daily-scrape.sh` | Main scraper script |
| `~/GBITAppsTracker/scripts/webhook-server.js` | Remote trigger server |
| `~/Library/LaunchAgents/com.hriq.scraper.plist` | Scheduled task config |
| `/tmp/hriq-scraper.log` | Scraper output log |
| `/tmp/hriq-scraper-error.log` | Scraper error log |

---

## Manual Commands

### Run Scraper Manually
```bash
cd ~/GBITAppsTracker
./scripts/daily-scrape.sh
```

### Check LaunchAgent Status
```bash
launchctl list | grep hriq
```

### View Logs
```bash
# Recent output
tail -50 /tmp/hriq-scraper.log

# Watch live
tail -f /tmp/hriq-scraper.log
```

### Reload LaunchAgent
```bash
launchctl unload ~/Library/LaunchAgents/com.hriq.scraper.plist
launchctl load ~/Library/LaunchAgents/com.hriq.scraper.plist
```

### Check Webhook Server
```bash
pm2 status
pm2 logs hriq-webhook
```

---

## Troubleshooting

### Scraper fails with "Login form not found"
- The HR portal may be blocking the IP. Only works from office network.
- Check if you can access `https://essportal.goldbell.com.sg` in a browser.

### Git push fails
- Ensure credentials are configured: `git config --global credential.helper osxkeychain`
- Or set up SSH keys for GitHub.

### LaunchAgent not running
- Mac must be logged in (not just powered on)
- Check logs: `cat /tmp/hriq-scraper-error.log`
- Ensure script has execute permission: `chmod +x scripts/daily-scrape.sh`

### Webhook server not accessible
- Check firewall settings: System Preferences → Security & Privacy → Firewall
- Verify port forwarding on router
- Test locally first: `curl http://localhost:3847/health`

---

## Security Notes

- `.env` file contains credentials - never commit to Git
- Webhook server uses a secret token for authentication
- Consider using Tailscale for secure remote access without port forwarding

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Pages   │     │    Mac Mini      │     │   HR Portal     │
│   (Website)     │────▶│  (Scraper)       │────▶│  (Data Source)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │  Refresh Button       │ Daily 8 AM
        │  (webhook call)       │ (LaunchAgent)
        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Repository                             │
│                 (leaves.json auto-updated)                       │
└─────────────────────────────────────────────────────────────────┘
```
