#!/usr/bin/env node
/**
 * HRIQ Webhook Server
 * Allows remote triggering of the leave calendar scraper
 *
 * Endpoints:
 *   GET  /health - Health check
 *   POST /scrape - Trigger scraper (requires token)
 *   GET  /status - Get last scrape status
 */

const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3847;
const SECRET_TOKEN = process.env.HRIQ_WEBHOOK_TOKEN || 'hriq-refresh-2026';
const PROJECT_DIR = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(__dirname, 'daily-scrape.sh');

let lastScrapeStatus = {
  running: false,
  lastRun: null,
  lastResult: null,
  lastError: null
};

function runScraper() {
  if (lastScrapeStatus.running) {
    return Promise.reject(new Error('Scraper already running'));
  }

  lastScrapeStatus.running = true;
  lastScrapeStatus.lastRun = new Date().toISOString();

  return new Promise((resolve, reject) => {
    console.log(`[${new Date().toISOString()}] Starting scraper...`);

    exec(SCRIPT_PATH, { cwd: PROJECT_DIR, timeout: 180000 }, (error, stdout, stderr) => {
      lastScrapeStatus.running = false;

      if (error) {
        lastScrapeStatus.lastResult = 'error';
        lastScrapeStatus.lastError = error.message;
        console.error(`[${new Date().toISOString()}] Scraper error:`, error.message);
        reject(error);
      } else {
        lastScrapeStatus.lastResult = 'success';
        lastScrapeStatus.lastError = null;
        console.log(`[${new Date().toISOString()}] Scraper completed successfully`);
        resolve(stdout);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  // CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Status check
  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lastScrapeStatus));
    return;
  }

  // Trigger scraper
  if (url.pathname === '/scrape' && req.method === 'POST') {
    // Check token
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '') || url.searchParams.get('token');

    if (token !== SECRET_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Run scraper
    runScraper()
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Scraper completed' }));
      })
      .catch((error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`HRIQ Webhook Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Trigger scrape: POST http://localhost:${PORT}/scrape (requires token)`);
});
