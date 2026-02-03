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
      // Add cache-busting query param to force fresh fetch
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
    } finally {
      btn.classList.remove('spinning');
      btn.disabled = false;
    }
  }

  render() {
    this.updateMonthDisplay();
    this.renderCalendar();
    this.updateStats();
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

    // Leave entries
    if (dayLeaves.length > 0) {
      const entriesContainer = document.createElement('div');
      entriesContainer.className = 'leave-entries';

      const maxVisible = 3;
      const visibleLeaves = dayLeaves.slice(0, maxVisible);
      const hiddenCount = dayLeaves.length - maxVisible;

      visibleLeaves.forEach(leave => {
        const entry = this.createLeaveEntry(leave);
        entriesContainer.appendChild(entry);
      });

      if (hiddenCount > 0) {
        const moreEl = document.createElement('div');
        moreEl.className = 'more-entries';
        moreEl.textContent = `+${hiddenCount} more`;
        moreEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showDayModal(date, dayLeaves, dayHoliday);
        });
        entriesContainer.appendChild(moreEl);
      }

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
    name.textContent = this.formatName(leave.employee);
    name.title = leave.employee; // Full name on hover

    const type = document.createElement('span');
    type.className = 'leave-type';
    type.textContent = leave.leaveType;

    entry.appendChild(name);
    entry.appendChild(type);

    return entry;
  }

  formatName(fullName) {
    // Shorten long names: "JOHN YANG JIA HAN" -> "JOHN Y."
    const parts = fullName.split(' ');
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[1].charAt(0)}.`;
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
      html += `
        <div class="modal-leave-item">
          <div class="modal-leave-color" style="background: ${color};"></div>
          <div class="modal-leave-info">
            <div class="modal-leave-name">${leave.employee}</div>
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new LeaveCalendar();
});
