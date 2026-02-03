// Leave Calendar App - Corporate Zen Edition
class LeaveCalendar {
  constructor() {
    this.data = null;
    this.currentDate = new Date();

    // Leave type colors matching CSS variables
    this.leaveTypes = {
      'ANNU': { name: 'Annual Leave', color: '#4a7c59' },
      'SL': { name: 'Sick Leave', color: '#c9485b' },
      'WFH': { name: 'Work From Home', color: '#7c6a9e' },
      'WFH 2': { name: 'Work From Home', color: '#7c6a9e' },
      'NSL': { name: 'National Service Leave', color: '#5a8f8f' },
      'CCL': { name: 'Childcare Leave', color: '#d4914d' },
      'ML': { name: 'Medical Leave', color: '#b85a5a' },
      'PL': { name: 'Paternity Leave', color: '#5a8fb8' },
      'UL': { name: 'Unpaid Leave', color: '#7a7a8a' },
      'CL': { name: 'Compassionate Leave', color: '#8a6a5a' },
      'HL': { name: 'Hospitalization Leave', color: '#d46a4a' }
    };

    // Friendly name mapping
    this.nameMap = {
      'JOHN YANG JIA HAN': 'John',
      'LEE CHIN HAI (EDDY)': 'Eddy',
      'MOHD ELIYAZAR BIN ISMAIL': 'Eliyazar',
      'MOHD ELIYAZAR BIN RUSLAN': 'Eliyazar',
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

    // Modal events
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
      if (!response.ok) throw new Error('Data file not found');
      this.data = await response.json();
      this.updateSyncStatus();
    } catch (error) {
      console.error('Error loading data:', error);
      this.data = { leaves: [], holidays: [] };
      this.setSyncStatus('Data unavailable', false);
    }
  }

  updateSyncStatus() {
    if (this.data?.scrapedAt) {
      const date = new Date(this.data.scrapedAt);
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      this.setSyncStatus(`${dateStr}, ${timeStr}`, true);
    }
  }

  setSyncStatus(text, isOk) {
    const statusEl = document.getElementById('lastUpdated');
    const dot = statusEl.querySelector('.sync-dot');
    const textEl = statusEl.querySelector('.sync-text');

    textEl.textContent = text;
    dot.style.background = isOk ? '#4a7c59' : '#c9485b';
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.render();
  }

  async refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    btn.disabled = true;
    this.setSyncStatus('Refreshing...', true);

    try {
      // Fetch fresh data (cache-busted)
      const response = await fetch('./data/leaves.json?t=' + Date.now());
      if (!response.ok) throw new Error('Data file not found');

      this.data = await response.json();
      this.updateSyncStatus();
      this.render();
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.setSyncStatus('Refresh failed', false);
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

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const dayLeaves = this.getLeavesForDate(date);
    const dayHoliday = this.getHolidayForDate(date);

    // Holiday
    if (dayHoliday) {
      cell.classList.add('holiday');
      const holidayEl = document.createElement('div');
      holidayEl.className = 'holiday-name';
      holidayEl.textContent = dayHoliday.name;
      holidayEl.title = dayHoliday.name;
      cell.appendChild(holidayEl);
    }

    // Leave entries
    if (dayLeaves.length > 0) {
      cell.classList.add('has-leaves');
      const entriesContainer = document.createElement('div');
      entriesContainer.className = 'leave-entries';

      dayLeaves.forEach(leave => {
        const entry = this.createLeaveEntry(leave);
        entriesContainer.appendChild(entry);
      });

      cell.appendChild(entriesContainer);
    }

    // Click to show modal
    if (dayLeaves.length > 0 || dayHoliday) {
      cell.addEventListener('click', () => {
        this.showDayModal(date, dayLeaves, dayHoliday);
      });
    }

    return cell;
  }

  createLeaveEntry(leave) {
    const entry = document.createElement('div');
    entry.className = 'leave-entry';
    const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#7a7a8a';
    entry.style.borderLeftColor = color;

    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = this.getDisplayName(leave);
    name.title = leave.employee;

    const type = document.createElement('span');
    type.className = 'leave-type';
    type.textContent = leave.leaveType;

    entry.appendChild(name);
    entry.appendChild(type);

    return entry;
  }

  getDisplayName(leave) {
    return leave.displayName || this.nameMap[leave.employee] || this.formatName(leave.employee);
  }

  formatName(fullName) {
    if (this.nameMap[fullName]) return this.nameMap[fullName];
    const parts = fullName.split(' ');
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }

  getLeavesForDate(date) {
    if (!this.data?.leaves) return [];

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return this.data.leaves.filter(leave => {
      if (leave.year && leave.month) {
        return leave.date === day && leave.month === month && leave.year === year;
      }
      const dataMonth = parseInt(this.data.month) || (new Date().getMonth() + 1);
      const dataYear = parseInt(this.data.year) || new Date().getFullYear();
      return leave.date === day && month === dataMonth && year === dataYear;
    });
  }

  getHolidayForDate(date) {
    if (!this.data?.holidays) return null;

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

    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    modalDate.textContent = date.toLocaleDateString('en-US', options);

    let html = '';

    if (holiday) {
      html += `
        <div class="modal-leave-item">
          <div class="modal-leave-color" style="background: #3d7ea6;"></div>
          <div class="modal-leave-info">
            <div class="modal-leave-name">${holiday.name}</div>
            <div class="modal-leave-type">Public Holiday</div>
          </div>
        </div>
      `;
    }

    leaves.forEach(leave => {
      const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#7a7a8a';
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
      html = '<p style="text-align: center; color: #9e9eb0; padding: 24px;">No leaves on this day</p>';
    }

    modalLeaves.innerHTML = html;
    modal.classList.add('active');
  }

  closeModal() {
    document.getElementById('dayModal').classList.remove('active');
  }

  updateStats() {
    const currentMonth = this.currentDate.getMonth() + 1;
    const currentYear = this.currentDate.getFullYear();

    // Filter leaves for current viewing month
    const monthLeaves = this.data?.leaves?.filter(l =>
      l.month === currentMonth && l.year === currentYear
    ) || [];

    document.getElementById('totalLeaves').textContent = monthLeaves.length;

    const uniqueEmployees = new Set(monthLeaves.map(l => l.employee)).size;
    document.getElementById('employeesOnLeave').textContent = uniqueEmployees;

    // Working days
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    let workingDays = 0;
    const monthHolidays = this.data?.holidays?.filter(h =>
      h.month === currentMonth && h.year === currentYear
    ) || [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth - 1, d);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = monthHolidays.some(h => h.date === d);
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

    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const dateStr = today.toLocaleDateString('en-US', options);

    let html = `<div class="sidebar-date">${dateStr}</div>`;

    if (todayHoliday) {
      html += `
        <div class="sidebar-holiday">
          <span class="holiday-icon">🎊</span>
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
        const color = this.leaveTypes[leave.leaveType]?.color || leave.color || '#7a7a8a';
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new LeaveCalendar();
});
