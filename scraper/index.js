const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const CONFIG = {
  baseUrl: 'https://essportal.goldbell.com.sg',
  loginUrl: 'https://essportal.goldbell.com.sg/HR/Main/Login.aspx',
  calendarUrl: 'https://essportal.goldbell.com.sg/LEAVE/Leave/eLeave/ViewLeaveCalendar2.aspx',
  credentials: {
    userId: process.env.HRIQ_USER_ID,
    password: process.env.HRIQ_PASSWORD
  },
  outputPath: path.join(__dirname, '..', 'website', 'data', 'leaves.json')
};

// Leave type mapping for colors
const LEAVE_TYPES = {
  'ANNU': { name: 'Annual Leave', color: '#3498db' },
  'SL': { name: 'Sick Leave', color: '#e74c3c' },
  'WFH': { name: 'Work From Home', color: '#9b59b6' },
  'WFH 2': { name: 'Work From Home', color: '#9b59b6' },
  'NSL': { name: 'National Service Leave', color: '#1abc9c' },
  'CCL': { name: 'Childcare Leave', color: '#f39c12' },
  'ML': { name: 'Medical Leave', color: '#e91e63' },
  'PL': { name: 'Paternity Leave', color: '#00bcd4' },
  'UL': { name: 'Unpaid Leave', color: '#607d8b' },
  'CL': { name: 'Compassionate Leave', color: '#795548' },
  'HL': { name: 'Hospitalization Leave', color: '#ff5722' }
};

// Company-declared holidays (not in HR portal)
const COMPANY_HOLIDAYS = [
  { date: 16, month: 2, year: 2026, name: 'CNY Eve (Company Holiday)' },
  { date: 19, month: 2, year: 2026, name: 'CNY (Company Holiday)' }
];

// Friendly name mapping (system name -> display name)
const NAME_MAP = {
  'JOHN YANG JIA HAN': 'John',
  'LEE CHIN HAI (EDDY)': 'Eddy',
  'MOHD ELIYAZAR BIN ISMAIL': 'Eliyazar',
  'SARFARAZ ABDULLAH': 'Abdullah',
  'LIM YI HWEE (JOEY)': 'Joey',
  'TAN WEN XIAN (ALLEN)': 'Allen',
  'CHUA SIN HAI': 'Sin Hai'
};

async function scrapeLeaveCalendar() {
  // Validate credentials
  if (!CONFIG.credentials.userId || !CONFIG.credentials.password) {
    console.error('❌ Missing credentials. Please create .env file with HRIQ_USER_ID and HRIQ_PASSWORD');
    process.exit(1);
  }

  console.log('🚀 Starting HRIQ Leave Calendar Scraper...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  try {
    const page = await browser.newPage();

    // Hide webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.setViewport({ width: 1920, height: 1080 });

    // Step 1: Login
    console.log('🔐 Logging in...');
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for page to fully load and JavaScript to execute
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for login form to appear
    try {
      await page.waitForSelector('input[type="text"], input[type="password"]', { timeout: 15000 });
    } catch (e) {
      console.log('⚠️ Login form not found, saving debug screenshot...');
      await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'login-error.png'), fullPage: true });
      const html = await page.content();
      fs.writeFileSync(path.join(__dirname, '..', 'debug', 'login-error.html'), html);
    }

    // Debug: Log all input fields found
    const inputs = await page.$$eval('input', els => els.map(el => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder
    })));
    console.log('📝 Found input fields:', JSON.stringify(inputs, null, 2));

    // Fill login form - try multiple selectors
    const userIdField = await page.$('input[type="text"]')
      || await page.$('input[name*="UserID"]')
      || await page.$('input[id*="UserID"]')
      || await page.$('input[placeholder*="User"]');

    const passwordField = await page.$('input[type="password"]');

    if (!userIdField) {
      throw new Error('Could not find User ID field');
    }
    if (!passwordField) {
      throw new Error('Could not find Password field');
    }

    await userIdField.click({ clickCount: 3 }); // Select all
    await userIdField.type(CONFIG.credentials.userId);

    await passwordField.click({ clickCount: 3 });
    await passwordField.type(CONFIG.credentials.password);

    // Click sign in button - find it first
    const signInButton = await page.$('input[type="submit"]')
      || await page.$('button[type="submit"]')
      || await page.$('input[value*="SIGN"]')
      || await page.$('input[value*="Sign"]')
      || await page.$('.btn-login');

    if (!signInButton) {
      throw new Error('Could not find sign in button');
    }

    console.log('🖱️ Clicking sign in...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      signInButton.click()
    ]);

    // Wait a moment for redirect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if login was successful
    const currentUrl = page.url();
    console.log('📍 Current URL after login:', currentUrl);

    if (currentUrl.toLowerCase().includes('login')) {
      console.error('❌ Login failed. Please check your credentials.');
      console.log('💡 Keeping browser open for 30 seconds so you can inspect...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      process.exit(1);
    }
    console.log('✅ Login successful!');

    // Step 2: Navigate to Leave Calendar
    console.log('📅 Navigating to Leave Calendar...');
    await page.goto(CONFIG.calendarUrl, { waitUntil: 'networkidle2' });

    // Wait for the calendar to load
    await page.waitForSelector('.calendar, table, [class*="calendar"]', { timeout: 10000 });

    // Step 2.5: Select current month and year
    console.log('📆 Setting to current month...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    try {
      // Select current month
      await page.select('#ddlMonth', currentMonth.toString());
      // Select current year
      await page.select('#ddlYear', currentYear.toString());
      console.log(`📆 Selected: ${currentMonth}/${currentYear}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('⚠️ Could not set month/year dropdowns, using default...');
    }

    // Step 3: Set filter to "View all employees within my Department"
    console.log('🔧 Setting department filter...');
    try {
      // Check the department checkbox if not already checked
      const deptCheckbox = await page.$('input[type="checkbox"][id*="Department"], input[type="checkbox"]:nth-of-type(3)');
      if (deptCheckbox) {
        const isChecked = await page.evaluate(el => el.checked, deptCheckbox);
        if (!isChecked) {
          await deptCheckbox.click();
        }
      }

      // Click Show button to refresh calendar
      const showButton = await page.$('input[value="Show"]')
        || await page.$('input[value*="Show"]')
        || await page.$('.btn-show');

      if (showButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {}),
          showButton.click()
        ]);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for calendar to update
      }
    } catch (e) {
      console.log('⚠️ Could not set department filter, continuing with default view...');
    }

    // Step 4: Extract calendar data
    console.log('📊 Extracting leave data...');

    // Debug: Save screenshot and HTML
    const debugDir = path.join(__dirname, '..', 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(debugDir, 'calendar.png'), fullPage: true });
    const html = await page.content();
    fs.writeFileSync(path.join(debugDir, 'calendar.html'), html);
    console.log('📸 Debug screenshot and HTML saved to debug/ folder');

    const calendarData = await page.evaluate(() => {
      const data = {
        scrapedAt: new Date().toISOString(),
        month: '',
        year: '',
        holidays: [],
        leaves: []
      };

      // Get month/year from dropdowns
      const monthDropdown = document.querySelector('#ddlMonth');
      const yearDropdown = document.querySelector('#ddlYear');
      if (monthDropdown && yearDropdown) {
        data.month = monthDropdown.value || ''; // numeric month (1-12)
        data.monthName = monthDropdown.options[monthDropdown.selectedIndex]?.text || '';
        data.year = yearDropdown.value || '';
      }

      // Get the calendar table
      const calendarTable = document.querySelector('#tblCalendar');
      if (!calendarTable) {
        console.log('Calendar table not found');
        return data;
      }

      // Get all calendar cells (td elements in tblCalendar)
      const cells = calendarTable.querySelectorAll('td[valign="top"]');

      cells.forEach(cell => {
        // Get the date from blacktextsmall or redtextsmall span
        const dateSpan = cell.querySelector('span.blacktextsmall, span.redtextsmall');
        if (!dateSpan) return;

        const dateText = dateSpan.textContent.trim();
        // Extract just the number (date might include holiday name like "1   New Year's Day(SG)")
        const dateMatch = dateText.match(/^(\d{1,2})/);
        if (!dateMatch) return;

        const date = parseInt(dateMatch[1]);

        // Check for holidays (redtextsmall with holiday name)
        const holidaySpan = cell.querySelector('span.redtextsmall');
        if (holidaySpan) {
          const holidayText = holidaySpan.textContent.trim();
          const holidayMatch = holidayText.match(/\d+\s+(.+)/);
          if (holidayMatch) {
            const monthNum = data.month.toString().padStart(2, '0');
            const dayNum = date.toString().padStart(2, '0');
            data.holidays.push({
              date: date,
              fullDate: `${data.year}-${monthNum}-${dayNum}`,
              month: parseInt(data.month),
              year: parseInt(data.year),
              name: holidayMatch[1].trim()
            });
          }
        }

        // Extract leave entries - they're in nested tables with Approvedtextsmall spans
        const leaveRows = cell.querySelectorAll('table tr');

        leaveRows.forEach(row => {
          const nameSpan = row.querySelector('td[width="70%"] span.Approvedtextsmall');
          const typeSpan = row.querySelector('td[width="25%"] span.Approvedtextsmall');

          if (nameSpan && typeSpan) {
            const employee = nameSpan.textContent.trim();
            let leaveType = typeSpan.textContent.trim();

            // Remove leading " - " from leave type
            leaveType = leaveType.replace(/^\s*-\s*/, '');

            if (employee && leaveType) {
              // Create full date string (YYYY-MM-DD)
              const monthNum = data.month.toString().padStart(2, '0');
              const dayNum = date.toString().padStart(2, '0');
              const fullDate = `${data.year}-${monthNum}-${dayNum}`;

              data.leaves.push({
                date: date,
                fullDate: fullDate,
                month: parseInt(data.month),
                year: parseInt(data.year),
                employee: employee,
                leaveType: leaveType
              });
            }
          }
        });
      });

      return data;
    });

    // Enrich with leave type metadata and display names
    calendarData.leaves = calendarData.leaves.map(leave => ({
      ...leave,
      displayName: NAME_MAP[leave.employee] || leave.employee,
      leaveTypeName: LEAVE_TYPES[leave.leaveType]?.name || leave.leaveType,
      color: LEAVE_TYPES[leave.leaveType]?.color || '#999999'
    }));

    // Add company-declared holidays for current month
    const calMonth = parseInt(calendarData.month);
    const calYear = parseInt(calendarData.year);
    COMPANY_HOLIDAYS.forEach(holiday => {
      if (holiday.month === calMonth && holiday.year === calYear) {
        // Check if not already in holidays list
        const exists = calendarData.holidays.some(h =>
          h.date === holiday.date && h.month === holiday.month && h.year === holiday.year
        );
        if (!exists) {
          calendarData.holidays.push({
            date: holiday.date,
            fullDate: `${holiday.year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.date).padStart(2, '0')}`,
            month: holiday.month,
            year: holiday.year,
            name: holiday.name
          });
        }
      }
    });

    // Sort holidays by date
    calendarData.holidays.sort((a, b) => a.date - b.date);

    // Step 5: Save data
    console.log('💾 Saving data...');

    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG.outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to JSON
    fs.writeFileSync(CONFIG.outputPath, JSON.stringify(calendarData, null, 2));

    console.log(`✅ Data saved to ${CONFIG.outputPath}`);
    console.log(`📊 Found ${calendarData.leaves.length} leave entries`);
    console.log(`🎉 Holidays: ${calendarData.holidays.length}`);

    return calendarData;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

// Run if called directly
if (require.main === module) {
  scrapeLeaveCalendar()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { scrapeLeaveCalendar };
