// Leave Calendar App
class LeaveCalendar {
  constructor() {
    this.data = null;
    this.currentDate = new Date();
    this.leaveTypes = {
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

    // Friendly name mapping
    this.nameMap = {
      'JOHN YANG JIA HAN': 'John',
      'LEE CHIN HAI (EDDY)': 'Eddy',
      'MOHD ELIYAZAR BIN ISMAIL': 'Eliyazar',
      'SARFARAZ ABDULLAH': 'Abdullah',
      'LIM YI HWEE (JOEY)': 'Joey',
      'TAN WEN XIAN (ALLEN)': 'Allen',
      'CHUA SIN HAI': 'Sin Hai'
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadData();
    this.render();
  }

  bindEvents() {
    document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('dayModal').addEventListener('click', (e) => {
      if (e.target.id === 'dayModal') this.closeModal();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
      if (e.key === 'ArrowLeft') this.changeMonth(-1);
      if (e.key === 'ArrowRight') this.changeMonth(1);
    });
  }

  async loadData() {
    try {
      const response = await fetch('./data/leaves.json');
      if (!response.ok) {
        throw new Error('Data file not found');
      }
      this.data = await response.json();

      // Update last updated time
      if (this.data.scrapedAt) {
        const date = new Date(this.data.scrapedAt);
        document.getElementById('lastUpdated').textContent =
          `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.data = { leaves: [], holidays: [] };
      document.getElementById('lastUpdated').textContent = 'Data not available';
    }
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.render();
  }

  async refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    btn.disabled = true;

    try {
      // If webhook is configured, trigger remote scraper first
      if (typeof CONFIG !== 'undefined' && CONFIG.WEBHOOK_URL) {
        try {
          document.getElementById('lastUpdated').textContent = 'Scraping fresh data...';
          const webhookResponse = await fetch(`${CONFIG.WEBHOOK_URL}/scrape`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CONFIG.WEBHOOK_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          if (!webhookResponse.ok) {
            console.warn('Webhook failed, loading cached data');
          } else {
            // Wait a moment for GitHub Pages to update
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (webhookError) {
          console.warn('Webhook unavailable:', webhookError.message);
        }
      }

      // Fetch the JSON data (fresh or cached)
      const response = await fetch('./data/leaves.json?t=' + Date.now());
      if (!response.ok) throw new Error('Data file not found');

      this.data = await response.json();

      if (this.data.scrapedAt) {
        const date = new Date(this.data.scrapedAt);
        document.getElementById('lastUpdated').textContent =
          `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }

      this.render();
    } catch (error) {
      console.error('Error refreshing data:', error);
      document.getElementById('lastUpdated').textContent = 'Refresh failed';
    } finally {
      btn.classList.remove('spinning');
      btn.disabled = false;
    }
  }

  render() {
    this.updateMonthDisplay();
    this.renderCalendar();
    this.updateStats();
    this.renderTodaySidebar();
  }

  updateMonthDisplay() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();
    document.getElementById('currentMonth').textContent = `${month} ${year}`;
  }

  renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing the 1st
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // End on Saturday of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate cells
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const cell = this.createDayCell(currentDate, month, today);
      grid.appendChild(cell);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  createDayCell(date, currentMonth, today) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    const day = date.getDate();
    const isOtherMonth = date.getMonth() !== currentMonth;
    const isToday = date.getTime() === today.getTime();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (isOtherMonth) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today');
    if (isWeekend) cell.classList.add('weekend');

    // Date number
    const dateNum = document.createElement('div');
    dateNum.className = 'date-number';
    dateNum.textContent = day;
    cell.appendChild(dateNum);

    // Get leaves for this day
    const dayLeaves = this.getLeavesForDate(date);
    const dayHoliday = this.getHolidayForDate(date);

    // Holiday
    if (dayHoliday) {
      cell.classList.add('holiday');
      const holidayEl = document.createElement('div');
      holidayEl.className = 'holiday-name';
      holidayEl.textContent = dayHoliday.name;
      cell.appendChild(holidayEl);
    }

    // Leave entries - show all entries (scrollable if many)
    if (dayLeaves.length > 0) {
      const entriesContainer = document.createElement('div');
      entriesContainer.className = 'leave-entries';

      // Show all leaves
      dayLeaves.forEach(leave => {
        const entry = this.createLeaveEntry(leave);
        entriesContainer.appendChild(entry);
      });

      cell.appendChild(entriesContainer);
    }

    // Click to show all
    if (dayLeaves.length > 0 || dayHoliday) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        this.showDayModal(date, dayLeaves, dayHoliday);
      });
    }

    return cell;
  }

  createLeaveEntry(leave) {
    const entry = document.createElement('div');
    entry.className = 'leave-entry';
    const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#999';
    entry.style.borderLeftColor = color;

    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = this.getDisplayName(leave);
    name.title = leave.employee; // Full name on hover

    const type = document.createElement('span');
    type.className = 'leave-type';
    type.textContent = leave.leaveType;

    entry.appendChild(name);
    entry.appendChild(type);

    return entry;
  }

  formatName(fullName) {
    // Use friendly name if available
    if (this.nameMap[fullName]) {
      return this.nameMap[fullName];
    }
    // Fallback: Shorten long names
    const parts = fullName.split(' ');
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }

  getDisplayName(leave) {
    // Use displayName from data if available, otherwise use nameMap
    return leave.displayName || this.nameMap[leave.employee] || this.formatName(leave.employee);
  }

  getLeavesForDate(date) {
    if (!this.data || !this.data.leaves) return [];

    const day = date.getDate();
    const month = date.getMonth() + 1; // JS months are 0-indexed
    const year = date.getFullYear();

    // Match based on full date (year, month, day)
    return this.data.leaves.filter(leave => {
      // If leave has full date info, use it
      if (leave.year && leave.month) {
        return leave.date === day && leave.month === month && leave.year === year;
      }
      // Fallback: match only if viewing the same month as the data
      const dataMonth = parseInt(this.data.month) || (new Date().getMonth() + 1);
      const dataYear = parseInt(this.data.year) || new Date().getFullYear();
      return leave.date === day && month === dataMonth && year === dataYear;
    });
  }

  getHolidayForDate(date) {
    if (!this.data || !this.data.holidays) return null;

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return this.data.holidays.find(h => {
      if (h.year && h.month) {
        return h.date === day && h.month === month && h.year === year;
      }
      const dataMonth = parseInt(this.data.month) || (new Date().getMonth() + 1);
      const dataYear = parseInt(this.data.year) || new Date().getFullYear();
      return h.date === day && month === dataMonth && year === dataYear;
    });
  }

  showDayModal(date, leaves, holiday) {
    const modal = document.getElementById('dayModal');
    const modalDate = document.getElementById('modalDate');
    const modalLeaves = document.getElementById('modalLeaves');

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    modalDate.textContent = date.toLocaleDateString('en-US', options);

    let html = '';

    if (holiday) {
      html += `
        <div class="modal-leave-item">
          <div class="modal-leave-color" style="background: linear-gradient(135deg, #00bcd4 0%, #00838f 100%);"></div>
          <div class="modal-leave-info">
            <div class="modal-leave-name">${holiday.name}</div>
            <div class="modal-leave-type">Public Holiday</div>
          </div>
        </div>
      `;
    }

    leaves.forEach(leave => {
      const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#999';
      const typeName = this.leaveTypes[leave.leaveType]?.name || leave.leaveType;
      const displayName = this.getDisplayName(leave);
      html += `
        <div class="modal-leave-item">
          <div class="modal-leave-color" style="background: ${color};"></div>
          <div class="modal-leave-info">
            <div class="modal-leave-name">${displayName}</div>
            <div class="modal-leave-type">${typeName}</div>
          </div>
        </div>
      `;
    });

    if (!holiday && leaves.length === 0) {
      html = '<p style="color: #999; text-align: center;">No leaves on this day</p>';
    }

    modalLeaves.innerHTML = html;
    modal.classList.add('active');
  }

  closeModal() {
    document.getElementById('dayModal').classList.remove('active');
  }

  updateStats() {
    if (!this.data || !this.data.leaves) {
      document.getElementById('totalLeaves').textContent = '0';
      document.getElementById('employeesOnLeave').textContent = '0';
      document.getElementById('workingDays').textContent = '0';
      return;
    }

    // Total leaves this month
    const totalLeaves = this.data.leaves.length;
    document.getElementById('totalLeaves').textContent = totalLeaves;

    // Unique employees
    const uniqueEmployees = new Set(this.data.leaves.map(l => l.employee)).size;
    document.getElementById('employeesOnLeave').textContent = uniqueEmployees;

    // Working days in month (excluding weekends and holidays)
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = this.data.holidays?.some(h => h.date === d);
      if (!isWeekend && !isHoliday) workingDays++;
    }
    document.getElementById('workingDays').textContent = workingDays;
  }

  renderTodaySidebar() {
    const sidebar = document.getElementById('todaySidebar');
    if (!sidebar) return;

    const today = new Date();
    const todayLeaves = this.getLeavesForDate(today);
    const todayHoliday = this.getHolidayForDate(today);

    // Format today's date
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const dateStr = today.toLocaleDateString('en-US', options);

    let html = `
      <div class="sidebar-date">${dateStr}</div>
    `;

    if (todayHoliday) {
      html += `
        <div class="sidebar-holiday">
          <span class="holiday-icon">🎉</span>
          <span>${todayHoliday.name}</span>
        </div>
      `;
    }

    if (todayLeaves.length === 0 && !todayHoliday) {
      html += `
        <div class="sidebar-empty">
          <div class="empty-icon">✓</div>
          <div class="empty-text">Everyone's in today!</div>
        </div>
      `;
    } else if (todayLeaves.length > 0) {
      html += `<div class="sidebar-section-title">On Leave Today</div>`;
      html += `<div class="sidebar-leaves">`;

      todayLeaves.forEach(leave => {
        const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#999';
        const typeName = this.leaveTypes[leave.leaveType]?.name || leave.leaveType;
        const displayName = this.getDisplayName(leave);

        html += `
          <div class="sidebar-leave-item">
            <div class="sidebar-leave-color" style="background: ${color};"></div>
            <div class="sidebar-leave-info">
              <div class="sidebar-leave-name">${displayName}</div>
              <div class="sidebar-leave-type">${typeName}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    sidebar.innerHTML = html;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new LeaveCalendar();
});
