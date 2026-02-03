// HRIQ Configuration
// Update WEBHOOK_URL after setting up the Mac Mini

const CONFIG = {
  // Webhook URL for remote scraping (Mac Mini)
  // Set to null to disable webhook refresh (just reload JSON)
  // Examples:
  //   - Local network: 'http://192.168.1.100:3847'
  //   - With ngrok: 'https://abc123.ngrok.io'
  //   - With Tailscale: 'http://mac-mini.tail1234.ts.net:3847'
  WEBHOOK_URL: null,

  // Webhook authentication token (must match server)
  WEBHOOK_TOKEN: 'hriq-refresh-2026',

  // Auto-refresh interval (milliseconds) - set to 0 to disable
  AUTO_REFRESH_INTERVAL: 0
};
