const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const CONFIG = {
  baseUrl: 'https://essportal.goldbell.com.sg',
  loginUrl: 'https://essportal.goldbell.com.sg/HR/main/login.aspx',
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
  'MOHD ELIYAZAR BIN RUSLAN': 'Eliyazar',
  'SARFARAZ ABDULLAH': 'Abdullah',
  'LIM YI HWEE (JOEY)': 'Joey',
  'TAN WEN XIAN (ALLEN)': 'Allen',
  'CHUA SIN HAI': 'Sin Hai',
  'LEE KIAN HOW': 'Kian How',
  'CHIN WAI MUN': 'Wai Mun',
  'NEO ZHI KAI': 'Zhi Kai'
};

// Helper to strip (AM)/(PM) from employee name and return both
function parseEmployeeName(rawName) {
  const match = rawName.match(/^(.+?)\s*\((AM|PM)\)$/);
  if (match) {
    return { name: match[1].trim(), period: match[2] };
  }
  return { name: rawName, period: null };
}

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
    await signInButton.click();

    // Wait for login to complete (ASP.NET postback doesn't always trigger navigation)
    await page.waitForFunction(
      () => !window.location.href.toLowerCase().includes('login'),
      { timeout: 30000 }
    );

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

    // Step 2.5: We'll scrape previous month, current month, AND next month (3 months total)
    console.log('📆 Will scrape previous month, current month, and next month...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // Calculate previous month
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    // Calculate next month
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = currentYear + 1;
    }

    const monthsToScrape = [
      { month: prevMonth, year: prevYear },
      { month: currentMonth, year: currentYear },
      { month: nextMonth, year: nextYear }
    ];

    // Companies to scrape: GBC first, then GBL
    const COMPANIES = [
      { code: 'GBC', name: 'GOLDBELL CORPORATION PTE LTD' },
      { code: 'GBL', name: 'GOLDBELL LEASING PTE LTD' }
    ];

    // Combined data for all months
    const allLeavesData = {
      scrapedAt: new Date().toISOString(),
      months: [],
      holidays: [],
      leaves: []
    };

    for (const monthInfo of monthsToScrape) {
      console.log(`\n📆 Scraping ${monthInfo.month}/${monthInfo.year}...`);

      // Accumulate leaves from both companies for this month
      let monthLeaves = [];
      let monthHolidays = [];
      let monthName = '';

      for (const company of COMPANIES) {
        console.log(`🏢 Switching to ${company.name}...`);

        // Select company (triggers postback)
        try {
          const currentCompany = await page.$eval('#ddlCompanyCode', el => el.value);
          if (currentCompany !== company.code) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
              page.select('#ddlCompanyCode', company.code)
            ]);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (e) {
          console.log(`⚠️ Could not select company ${company.code}, skipping...`);
          continue;
        }

        // Set month/year AFTER company selection (postback resets these)
        try {
          await page.select('#ddlMonth', monthInfo.month.toString());
          await page.select('#ddlYear', monthInfo.year.toString());
          console.log(`📆 Selected: ${monthInfo.month}/${monthInfo.year}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log('⚠️ Could not set month/year dropdowns, using default...');
        }

        // Set filter to "View all employees within my Department"
        console.log('🔧 Setting department filter...');
        try {
          const deptCheckbox = await page.$('input[type="checkbox"][id*="Department"], input[type="checkbox"]:nth-of-type(3)');
          if (deptCheckbox) {
            const isChecked = await page.evaluate(el => el.checked, deptCheckbox);
            if (!isChecked) {
              await deptCheckbox.click();
            }
          }

          const showButton = await page.$('input[value="Show"]')
            || await page.$('input[value*="Show"]')
            || await page.$('.btn-show');

          if (showButton) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {}),
              showButton.click()
            ]);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (e) {
          console.log('⚠️ Could not set department filter, continuing with default view...');
        }

        // Extract calendar data
        console.log(`📊 Extracting leave data for ${company.code}...`);

        // Debug: Save screenshot and HTML
        const debugDir = path.join(__dirname, '..', 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        await page.screenshot({ path: path.join(debugDir, `calendar-${company.code}-${monthInfo.month}-${monthInfo.year}.png`), fullPage: true });
        const html = await page.content();
        fs.writeFileSync(path.join(debugDir, `calendar-${company.code}-${monthInfo.month}-${monthInfo.year}.html`), html);

        // Get basic month info and find cells with "More" links
        const basicData = await page.evaluate(() => {
          const data = {
            month: '',
            year: '',
            monthName: '',
            holidays: [],
            leaves: [],
            datesWithMore: []
          };

          const monthDropdown = document.querySelector('#ddlMonth');
          const yearDropdown = document.querySelector('#ddlYear');
          if (monthDropdown && yearDropdown) {
            data.month = monthDropdown.value || '';
            data.monthName = monthDropdown.options[monthDropdown.selectedIndex]?.text || '';
            data.year = yearDropdown.value || '';
          }

          const calendarTable = document.querySelector('#tblCalendar');
          if (!calendarTable) return data;

          const cells = calendarTable.querySelectorAll('td[valign="top"]');

          cells.forEach(cell => {
            const dateSpan = cell.querySelector('span.blacktextsmall, span.redtextsmall');
            if (!dateSpan) return;

            const dateText = dateSpan.textContent.trim();
            const dateMatch = dateText.match(/^(\d{1,2})/);
            if (!dateMatch) return;

            const date = parseInt(dateMatch[1]);

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

            const moreLink = cell.querySelector('a[href*="openlookup"]');
            if (moreLink) {
              const hrefMatch = moreLink.href.match(/openlookup\('(\d+\/\d+\/\d+)'/);
              if (hrefMatch) {
                data.datesWithMore.push({
                  date: date,
                  lookupDate: hrefMatch[1]
                });
              }
            }

            const leaveRows = cell.querySelectorAll('table tr');
            leaveRows.forEach(row => {
              const nameSpan = row.querySelector('td[width="70%"] span.Approvedtextsmall');
              const typeSpan = row.querySelector('td[width="25%"] span.Approvedtextsmall');

              if (nameSpan && typeSpan) {
                const employee = nameSpan.textContent.trim();
                let leaveType = typeSpan.textContent.trim();
                leaveType = leaveType.replace(/^\s*-\s*/, '');

                if (employee && leaveType) {
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

        // For dates with "More" links, click to get full list
        if (basicData.datesWithMore.length > 0) {
          console.log(`📋 Found ${basicData.datesWithMore.length} dates with hidden entries, fetching...`);

          for (const dateInfo of basicData.datesWithMore) {
            try {
              const moreLinks = await page.$$('a[href*="openlookup"]');
              for (const link of moreLinks) {
                const href = await page.evaluate(el => el.href, link);
                if (href.includes(`'${dateInfo.lookupDate}'`)) {
                  const [popup] = await Promise.all([
                    new Promise(resolve => page.once('popup', resolve)),
                    link.click()
                  ]);

                  await popup.waitForSelector('table, .Approvedtextsmall', { timeout: 5000 });
                  await new Promise(resolve => setTimeout(resolve, 500));

                  const popupHtml = await popup.content();
                  fs.writeFileSync(path.join(debugDir, `popup-${company.code}-${dateInfo.date}.html`), popupHtml);

                  const popupLeaves = await popup.evaluate(() => {
                    const leaves = [];
                    const spans = document.querySelectorAll('#tblCalendar span.Approvedtextsmall');

                    spans.forEach(span => {
                      const text = span.textContent.trim();
                      const match = text.match(/^(.+?)\s*-\s*([A-Z0-9\s]+?)(?:\s*\((AM|PM)\))?$/);
                      if (match) {
                        const employee = match[1].trim();
                        const leaveType = match[2].trim();
                        const period = match[3] || null;
                        if (employee && leaveType) {
                          leaves.push({ employee, leaveType, period });
                        }
                      }
                    });

                    return leaves;
                  });

                  const monthNum = basicData.month.toString().padStart(2, '0');
                  const dayNum = dateInfo.date.toString().padStart(2, '0');
                  const fullDate = `${basicData.year}-${monthNum}-${dayNum}`;

                  basicData.leaves = basicData.leaves.filter(l => l.fullDate !== fullDate);

                  popupLeaves.forEach(leave => {
                    basicData.leaves.push({
                      date: dateInfo.date,
                      fullDate: fullDate,
                      month: parseInt(basicData.month),
                      year: parseInt(basicData.year),
                      employee: leave.employee,
                      leaveType: leave.leaveType,
                      period: leave.period
                    });
                  });

                  await popup.close();
                  console.log(`  ✓ Date ${dateInfo.date}: Found ${popupLeaves.length} entries`);
                  break;
                }
              }
            } catch (e) {
              console.log(`  ⚠️ Could not fetch full data for date ${dateInfo.date}: ${e.message}`);
            }
          }
        }

        monthName = monthName || basicData.monthName;
        monthLeaves.push(...basicData.leaves);
        monthHolidays.push(...basicData.holidays);
        console.log(`📊 ${company.code}: Found ${basicData.leaves.length} leave entries`);
      } // End of companies loop

      // Enrich with leave type metadata and display names
      monthLeaves = monthLeaves.map(leave => {
        const parsed = parseEmployeeName(leave.employee);
        const cleanName = parsed.name;
        const period = leave.period || parsed.period;

        return {
          ...leave,
          employee: cleanName,
          period: period,
          displayName: NAME_MAP[cleanName] || cleanName,
          leaveTypeName: LEAVE_TYPES[leave.leaveType]?.name || leave.leaveType,
          color: LEAVE_TYPES[leave.leaveType]?.color || '#999999'
        };
      });

      // Deduplicate: same employee + same date + same leaveType + same period = same entry
      const seen = new Set();
      monthLeaves = monthLeaves.filter(leave => {
        const key = `${leave.fullDate}|${leave.employee}|${leave.leaveType}|${leave.period ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Deduplicate holidays
      const holidaySeen = new Set();
      monthHolidays = monthHolidays.filter(h => {
        const key = `${h.fullDate}|${h.name}`;
        if (holidaySeen.has(key)) return false;
        holidaySeen.add(key);
        return true;
      });

      // Add company-declared holidays for this month
      const calMonth = monthInfo.month;
      const calYear = monthInfo.year;
      COMPANY_HOLIDAYS.forEach(holiday => {
        if (holiday.month === calMonth && holiday.year === calYear) {
          const exists = monthHolidays.some(h =>
            h.date === holiday.date && h.month === holiday.month && h.year === holiday.year
          );
          if (!exists) {
            monthHolidays.push({
              date: holiday.date,
              fullDate: `${holiday.year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.date).padStart(2, '0')}`,
              month: holiday.month,
              year: holiday.year,
              name: holiday.name
            });
          }
        }
      });

      // Save this month's data to its own file (archive)
      const monthStr = String(monthInfo.month).padStart(2, '0');
      const yearStr = monthInfo.year;
      const monthFileName = `leaves-${yearStr}-${monthStr}.json`;
      const monthFilePath = path.join(path.dirname(CONFIG.outputPath), monthFileName);

      const monthFileData = {
        scrapedAt: new Date().toISOString(),
        month: monthInfo.month,
        year: monthInfo.year,
        monthName: monthName,
        holidays: monthHolidays,
        leaves: monthLeaves
      };
      fs.writeFileSync(monthFilePath, JSON.stringify(monthFileData, null, 2));
      console.log(`💾 Saved ${monthFileName}`);
      console.log(`📊 Combined: ${monthLeaves.length} leave entries for ${monthName} ${monthInfo.year}`);

      // Add this month's data to combined data
      allLeavesData.months.push({
        month: monthInfo.month,
        year: monthInfo.year,
        monthName: monthName
      });
      allLeavesData.holidays.push(...monthHolidays);
      allLeavesData.leaves.push(...monthLeaves);
    } // End of monthsToScrape loop

    // Sort holidays by fullDate
    allLeavesData.holidays.sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    // Sort leaves by fullDate
    allLeavesData.leaves.sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    // Step 5: Save data
    console.log('💾 Saving data...');

    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG.outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to JSON
    fs.writeFileSync(CONFIG.outputPath, JSON.stringify(allLeavesData, null, 2));

    console.log(`✅ Data saved to ${CONFIG.outputPath}`);
    console.log(`📊 Total: ${allLeavesData.leaves.length} leave entries across ${allLeavesData.months.length} months`);
    console.log(`🎉 Holidays: ${allLeavesData.holidays.length}`);

    return allLeavesData;

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
