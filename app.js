// Malaiba ES Classroom Pulse - Main Controller & Application Logic (app.js)

// Web Audio API Synthesizer for Offline Beep Sounds
const Sounds = {
  playSuccess() {
    this.beep(880, 0.15, 'sine'); // High pitch pleasant beep
  },
  playWarning() {
    this.beep(587, 0.25, 'triangle'); // Medium warning beep
  },
  playError() {
    this.beep(220, 0.35, 'sawtooth'); // Buzz error beep
  },
  beep(frequency, duration, type) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Web Audio blocked or not supported:', e);
    }
  }
};

// Application State Management
const App = {
  currentScreen: 'login',
  isOnline: navigator.onLine,
  isMockOffline: false, // Simulated connection toggle
  isSyncing: false,
  
  // Active session parameters
  sessionActive: false,
  sessionDate: '',
  sessionTimeIn: '07:30 AM',
  recentScans: [],
  
  // Student registration variables
  activeRegStudentId: null,
  isWaitingForRegScan: false,
  activeStudentPhoto: '',

  init() {
    // Set up SPA Screen navigation
    this.bindNavigation();
    
    // Set up Network connection listeners
    this.setupNetworkStatus();
    
    // Set up Keyboard Scanner Listener (for USB RFID readers)
    this.setupRFIDKeyboardListener();
    
    // Check initial login state
    this.checkLoginState();
    
    // Initialize Dashboard / UI rendering
    this.updateConnectivityUI();
    this.updatePendingSyncCount();
    
    // Setup connected hardware WebHID/WebUSB status listeners
    this.setupHardwareListeners();
    
    // Setup interval checks for automatic synchronization
    setInterval(() => this.triggerAutoSync(), 10000); // sync check every 10s

    // Check if running under file:// protocol and show warning
    if (window.location.protocol === 'file:') {
      console.warn("Malaiba ES Classroom Pulse is running directly from the local filesystem (file://).");
      setTimeout(() => {
        this.showToast("Warning: Running from local files. Please use http://localhost:8080 to avoid CORS errors with monthly reports.", 8000);
      }, 1500);
    }
  },

  // 1. SPA VIEW ROUTING
  bindNavigation() {
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', (e) => {
        const screenName = e.currentTarget.getAttribute('data-nav');
        if (screenName === 'logout') {
          this.handleLogout();
        } else {
          this.switchScreen(screenName);
        }
      });
    });

    // Handle Start Session button from Dashboard
    const startSessionBtn = document.getElementById('start-session-btn');
    if (startSessionBtn) {
      startSessionBtn.addEventListener('click', () => {
        this.switchScreen('session');
      });
    }
  },

  switchScreen(screenName) {
    const activeUser = Database.getActiveUser();
    if (!activeUser && screenName !== 'login') {
      screenName = 'login';
    } else if (activeUser && activeUser.needs_password_reset && screenName !== 'password-reset') {
      screenName = 'password-reset';
    }

    this.currentScreen = screenName;
    
    // Update active state in nav sidebar
    document.querySelectorAll('[data-nav]').forEach(item => {
      if (item.getAttribute('data-nav') === screenName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update visibility of divs
    document.querySelectorAll('.screen-view').forEach(screen => {
      screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // Hide or show sidebar and top header based on login screen
    const sidebar = document.getElementById('sidebar-container');
    const mainWrapper = document.getElementById('main-wrapper');
    const topHeader = document.getElementById('top-header');

    if (screenName === 'login' || screenName === 'password-reset') {
      if (sidebar) sidebar.style.display = 'none';
      if (topHeader) topHeader.style.display = 'none';
      if (mainWrapper) mainWrapper.style.marginLeft = '0';
    } else {
      if (sidebar) sidebar.style.display = 'flex';
      if (topHeader) topHeader.style.display = 'flex';
      if (mainWrapper) mainWrapper.style.marginLeft = 'var(--sidebar-width)';
      
      // Update screen-specific lists
      this.renderScreen(screenName);
    }
  },

  checkLoginState() {
    const activeUser = Database.getActiveUser();
    if (activeUser) {
      this.updateProfileUI(activeUser);
      if (activeUser.needs_password_reset) {
        this.switchScreen('password-reset');
      } else {
        this.adaptSidebarForRole(activeUser);
        this.switchScreen('dashboard');
      }
    } else {
      this.switchScreen('login');
    }
  },

  updateProfileUI(user) {
    document.querySelectorAll('.teacher-name').forEach(el => el.textContent = user.display_name);
    document.querySelectorAll('.teacher-role').forEach(el => el.textContent = user.role);
    document.querySelectorAll('.teacher-avatar').forEach(img => img.src = user.photo_path || 'assets/photos/teacher_santos.png');
  },

  adaptSidebarForRole(user) {
    const navStudents = document.getElementById('nav-students');
    const navTeachers = document.getElementById('nav-teachers');
    const portalSubtitle = document.getElementById('portal-subtitle');
    const startSessionBtn = document.getElementById('start-session-btn');
    
    if (user.is_principal) {
      if (navStudents) navStudents.style.display = 'none';
      if (navTeachers) navTeachers.style.display = 'flex';
      if (portalSubtitle) portalSubtitle.textContent = 'Malaiba ES • Principal Portal';
      if (startSessionBtn) startSessionBtn.style.display = 'none';
    } else {
      if (navStudents) navStudents.style.display = 'flex';
      if (navTeachers) navTeachers.style.display = 'none';
      if (portalSubtitle) portalSubtitle.textContent = 'Malaiba ES • Advisor Portal';
      if (startSessionBtn) startSessionBtn.style.display = 'flex';
    }
  },

  // 2. CONNECTIVITY & BACKGROUND SYNC LOGIC
  setupNetworkStatus() {
    const updateStatus = () => {
      this.isOnline = navigator.onLine;
      this.updateConnectivityUI();
      if (this.isOnline && !this.isMockOffline) {
        this.triggerAutoSync();
      }
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
  },

  setMockOffline(offlineState) {
    this.isMockOffline = offlineState;
    this.updateConnectivityUI();
    this.showToast(offlineState ? 'Simulating Offline Mode' : 'Simulating Online Mode');
    if (!offlineState && this.isOnline) {
      this.triggerAutoSync();
    }
  },

  updateConnectivityUI() {
    const statusText = document.getElementById('sync-status-text');
    const statusDot = document.getElementById('sync-status-dot');
    
    const isActuallyConnected = this.isOnline && !this.isMockOffline;
    
    if (statusDot) {
      statusDot.className = 'sync-dot';
      if (this.isSyncing) {
        statusDot.classList.add('syncing');
      } else if (isActuallyConnected) {
        statusDot.classList.add('online');
      }
    }

    if (statusText) {
      if (this.isSyncing) {
        statusText.textContent = 'Syncing...';
      } else if (isActuallyConnected) {
        statusText.textContent = 'Cloud Connected';
      } else {
        statusText.textContent = 'Offline (Saved Locally)';
      }
    }

    // Update Simulator checkbox
    const connectionToggle = document.getElementById('sim-network-toggle');
    if (connectionToggle) {
      connectionToggle.checked = isActuallyConnected;
    }
  },

  async triggerAutoSync() {
    const isActuallyConnected = this.isOnline && !this.isMockOffline;
    if (!isActuallyConnected || this.isSyncing) return;
    
    const count = Database.getUnsyncedCount();
    if (count === 0) return;

    this.isSyncing = true;
    this.updateConnectivityUI();
    
    try {
      const res = await Database.syncPendingRecords(this.isOnline);
      if (res.success && res.count > 0) {
        this.showToast(`Auto-Synced ${res.count} records to Cloud!`);
      }
    } catch (err) {
      console.warn('Sync failed:', err.message);
    } finally {
      this.isSyncing = false;
      this.updateConnectivityUI();
      this.updatePendingSyncCount();
      
      // Re-render current screen if it shows sync status
      if (this.currentScreen === 'records' || this.currentScreen === 'dashboard') {
        this.renderScreen(this.currentScreen);
      }
    }
  },

  updatePendingSyncCount() {
    const count = Database.getUnsyncedCount();
    const widget = document.getElementById('pending-sync-widget');
    if (widget) {
      if (count > 0) {
        widget.textContent = `${count} logs pending sync`;
        widget.style.display = 'inline-block';
      } else {
        widget.style.display = 'none';
      }
    }
  },

  // 3. RFID KEYBOARD INTERCEPTOR
  setupRFIDKeyboardListener() {
    let keyBuffer = '';
    let lastKeyTime = Date.now();

    window.addEventListener('keydown', (e) => {
      const currentTime = Date.now();
      
      // RFID scanners usually send keystrokes extremely rapidly (within <50ms of each other)
      // and terminate with an "Enter" keypress.
      if (currentTime - lastKeyTime > 60) {
        // If delay is large, clear buffer (user is typing normally)
        keyBuffer = '';
      }
      
      lastKeyTime = currentTime;

      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;

      if (e.key === 'Enter') {
        const cleanedUid = keyBuffer.trim().toUpperCase();
        if (cleanedUid.length >= 8 && cleanedUid.length <= 12) {
          console.log(`RFID Key Sequence Detected: ${cleanedUid}`);
          this.handleRFIDScan(cleanedUid);
          e.preventDefault();
        }
        keyBuffer = '';
      } else {
        // Only buffer letters and numbers
        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          keyBuffer += e.key;
        }
      }
    });
  },

  // Handle incoming RFID Scan Event (either physical or simulated)
  handleRFIDScan(rfidUid) {
    rfidUid = rfidUid.trim().toUpperCase();
    
    // Case A: App is in RFID registration mode (waiting for scan in student directory)
    if (this.isWaitingForRegScan && this.activeRegStudentId) {
      this.handleRegistrationScan(rfidUid);
      return;
    }

    // Case B: App is in Live Attendance scanning session
    if (this.sessionActive) {
      this.handleSessionScan(rfidUid);
      return;
    }

    // Otherwise: Show standard popup/toast indicating scan is ignored
    const student = Database.getStudentByRfid(rfidUid);
    if (student) {
      this.showToast(`Scanned RFID: ${student.full_name} (${student.grade_section})`);
    } else {
      this.showToast(`Unregistered Card Detected: ${rfidUid}`);
    }
  },

  // 4. ATTENDANCE SESSION LOGIC
  startAttendanceSession(dateValue, sessionType) {
    const targetDate = dateValue || new Date().toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    if (targetDate < todayStr) {
      Sounds.playError();
      this.showToast(`Lobby Closed: This attendance date is in the past. Please use Manual Check-in.`);
      return;
    }

    if (targetDate > todayStr) {
      Sounds.playError();
      this.showToast(`Lobby Not Open: This attendance date is in the future.`);
      return;
    }

    // Enforce Late Limits and Deadlines for today
    const sType = sessionType || (new Date().getHours() < 12 ? 'AM' : 'PM');
    const settings = Database.getSettings();
    const isAM = sType === 'AM';
    const startTimeStr = isAM ? settings.amStartTime : settings.pmStartTime;
    const deadlineTimeStr = isAM ? settings.amDeadline : settings.pmDeadline;

    const parseMins = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    };

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = parseMins(startTimeStr);
    const deadlineMins = parseMins(deadlineTimeStr);

    const format12h = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    if (currentMins < startMins) {
      Sounds.playError();
      this.showToast(`Lobby Not Open: The session starts at ${format12h(startTimeStr)}.`);
      return;
    }

    if (currentMins > deadlineMins) {
      Sounds.playError();
      this.showToast(`Lobby Closed: The scan deadline (${format12h(deadlineTimeStr)}) has passed.`);
      return;
    }

    this.sessionDate = targetDate;
    this.sessionType = sType;
    this.sessionActive = true;
    this.recentScans = [];
    
    // Switch views in session screen
    document.getElementById('session-setup-view').style.display = 'none';
    document.getElementById('session-active-layout').style.display = 'grid';
    document.getElementById('session-scanning-view').style.display = 'flex';
    document.getElementById('session-success-view').style.display = 'none';
    
    // Set date labels in UI
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date(this.sessionDate).toLocaleDateString('en-US', options);
    
    document.querySelectorAll('.session-date-display').forEach(el => {
      el.textContent = `${formattedDate} • ${this.sessionType === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}`;
    });

    this.renderSessionArrivals();
    this.renderSessionStats();
    
    this.showToast('Attendance Session Started');
    Sounds.playSuccess();
  },

  pauseAttendanceSession() {
    this.showToast('Attendance Session Paused');
    Sounds.playWarning();
  },

  stopAttendanceSession() {
    this.sessionActive = false;
    this.switchScreen('dashboard');
    this.showToast('Attendance Session Stopped');
    Sounds.playWarning();
  },

  handleSessionScan(rfidUid) {
    const student = Database.getStudentByRfid(rfidUid);
    
    if (!student) {
      Sounds.playError();
      this.showToast(`Error: Card ${rfidUid} not linked to any student profile.`);
      return;
    }

    // Duplicate Check
    const todayLogs = Database.getAttendanceByDate(this.sessionDate);
    const existing = todayLogs.find(a => a.student_id === student.id && a.session === this.sessionType);
    
    if (existing) {
      Sounds.playError();
      this.showToast(`Duplicate: ${student.full_name} is already checked in for this session.`);
      return;
    }

    // Enforce Late Limits and Deadlines
    const settings = Database.getSettings();
    const isAM = this.sessionType === 'AM';
    const startTimeStr = isAM ? settings.amStartTime : settings.pmStartTime;
    const lateMinTimeStr = isAM ? settings.amLateMin : settings.pmLateMin;
    const lateMaxTimeStr = isAM ? settings.amLateMax : settings.pmLateMax;
    const deadlineTimeStr = isAM ? settings.amDeadline : settings.pmDeadline;

    const parseMins = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    };

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = parseMins(startTimeStr);
    const lateMinMins = parseMins(lateMinTimeStr);
    const lateMaxMins = parseMins(lateMaxTimeStr);
    const deadlineMins = parseMins(deadlineTimeStr);

    const format12h = (tStr) => {
      const [h, m] = tStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    // 0. Block scan if session has not started yet
    if (currentMins < startMins) {
      Sounds.playError();
      this.showToast(`Lobby Not Open: The session starts at ${format12h(startTimeStr)}.`);
      return;
    }

    // 1. Block scan if past deadline
    if (currentMins > deadlineMins) {
      Sounds.playError();
      this.showToast(`Lobby Closed: The scan deadline (${format12h(deadlineTimeStr)}) has passed.`);
      return;
    }

    // 2. Compute status (any successful scan within deadline is PRESENT)
    let status = 'PRESENT';

    // Compute Check-in time string
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'
    const timeInStr = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    const displayTimeShort = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;

    // Save locally (will default synced: false if offline)
    const isActuallyConnected = this.isOnline && !this.isMockOffline;
    const record = Database.saveAttendanceRecord({
      student_id: student.id,
      date: this.sessionDate,
      session: this.sessionType,
      time_in: displayTimeShort,
      status: status,
      method: 'RFID Scan',
      synced: isActuallyConnected
    });

    this.updatePendingSyncCount();
    
    // Add to recent arrivals list (session scope)
    this.recentScans.unshift({
      student_id: student.id,
      name: student.full_name,
      time_in: displayTimeShort,
      status: status,
      photo_path: student.photo_path
    });

    // Render success/late screen card
    this.showScanSuccessCard(student, timeInStr, status);
    
    // Update active list and widgets
    this.renderSessionArrivals();
    this.renderSessionStats();
    
    if (isActuallyConnected) {
      this.triggerAutoSync();
    }
  },

  showScanSuccessCard(student, timeIn, status) {
    const successView = document.getElementById('session-success-view');
    const scanningView = document.getElementById('session-scanning-view');
    
    if (!successView || !scanningView) return;

    scanningView.style.display = 'none';
    successView.style.display = 'flex';

    // Populate data
    document.getElementById('success-student-photo').src = student.photo_path || 'assets/photos/student_mateo.png';
    document.getElementById('success-student-name').textContent = student.full_name;
    document.getElementById('success-student-id').textContent = student.student_number;
    document.getElementById('success-scan-time').textContent = `Recorded at ${timeIn}`;
    
    const banner = document.getElementById('success-status-banner');
    const bannerText = document.getElementById('success-status-text');
    const bannerIcon = document.getElementById('success-status-icon');

    if (status === 'ABSENT') {
      banner.className = 'status-checkin-banner absent';
      bannerText.textContent = 'ABSENT';
      bannerIcon.textContent = 'cancel';
      Sounds.playError();
    } else {
      banner.className = 'status-checkin-banner';
      bannerText.textContent = 'PRESENT';
      bannerIcon.textContent = 'check_circle';
      Sounds.playSuccess();
    }

    // Auto dismiss checkin card after 5 seconds to return to scanning view
    if (this.scanSuccessTimer) clearTimeout(this.scanSuccessTimer);
    this.scanSuccessTimer = setTimeout(() => {
      this.resetSuccessCard();
    }, 5000);
  },

  resetSuccessCard() {
    if (this.scanSuccessTimer) clearTimeout(this.scanSuccessTimer);
    
    const successView = document.getElementById('session-success-view');
    const scanningView = document.getElementById('session-scanning-view');
    
    if (successView && scanningView && this.sessionActive) {
      successView.style.display = 'none';
      scanningView.style.display = 'flex';
    }
  },

  // 5. REGISTRATION MODAL CONTROL
  openRfidRegistration(studentId) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    this.activeRegStudentId = studentId;
    this.isWaitingForRegScan = true;

    // Populate registration modal
    document.getElementById('reg-student-photo').src = student.photo_path || 'assets/photos/student_mateo.png';
    document.getElementById('reg-student-name').textContent = student.full_name;
    document.getElementById('reg-student-details').textContent = `${student.grade_section} • ID: ${student.student_number}`;
    document.getElementById('reg-uid-input').value = student.rfid_uid || '';
    
    const confirmBtn = document.getElementById('reg-confirm-btn');
    confirmBtn.disabled = !student.rfid_uid; // disable confirm unless UID exists

    const modal = document.getElementById('rfid-reg-modal');
    modal.classList.add('active');
    
    Sounds.playSuccess();
  },

  closeRfidRegistration() {
    this.isWaitingForRegScan = false;
    this.activeRegStudentId = null;
    document.getElementById('rfid-reg-modal').classList.remove('active');
  },

  handleRegistrationScan(rfidUid) {
    Sounds.playSuccess();
    document.getElementById('reg-uid-input').value = rfidUid;
    document.getElementById('reg-confirm-btn').disabled = false;
    this.showToast(`Card detected: ${rfidUid}`);
  },

  confirmRfidRegistration() {
    const rfidUid = document.getElementById('reg-uid-input').value;
    if (!rfidUid || !this.activeRegStudentId) return;

    try {
      Database.registerRFID(this.activeRegStudentId, rfidUid);
      this.closeRfidRegistration();
      this.showToast('RFID Linked Successfully!');
      Sounds.playSuccess();
      
      // Refresh students panel list
      this.renderScreen('students');
    } catch (err) {
      Sounds.playError();
      alert(err.message);
    }
  },

  // 6. SCREEN RENDERING DISPATCHER
  renderScreen(screenName) {
    const dateToday = new Date().toISOString().split('T')[0];
    const activeUser = Database.getActiveUser();
    
    this.populateSectionDropdowns();

    switch (screenName) {
      case 'dashboard':
        if (activeUser && activeUser.is_principal) {
          this.renderPrincipalDashboard(dateToday);
        } else {
          this.renderDashboard(dateToday);
        }
        break;
      case 'students':
        this.renderStudents();
        break;
      case 'teachers':
        this.renderTeachers();
        break;
      case 'records':
        this.renderRecords(dateToday);
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'session':
        this.renderSession();
        break;
    }
  },

  renderDashboard(dateToday) {
    this.currentDashboardDate = dateToday;
    const activeUser = Database.getActiveUser();
    const userSection = activeUser ? activeUser.section : 'Grade 3 - Narra';
    const sessionFilter = document.getElementById('dashboard-session-filter') ? document.getElementById('dashboard-session-filter').value : 'AM';
    const stats = Database.getAnalytics(dateToday, userSection, sessionFilter);
    
    // Update labels for advisor
    const titleText = document.getElementById('dashboard-title-text');
    const subtitleText = document.getElementById('dashboard-subtitle-text');
    
    if (titleText) titleText.textContent = 'Class Overview';
    if (subtitleText) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = new Date(dateToday).toLocaleDateString('en-US', options);
      subtitleText.textContent = `${formattedDate} • Section ${userSection} • ${sessionFilter === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}`;
    }

    // Toggle views: show recent scans table, hide principal section breakdown
    const recentScansTitle = document.getElementById('dash-recent-scans-title');
    const recentScansCard = document.getElementById('dash-recent-scans-card');
    const classroomBreakdown = document.getElementById('principal-classroom-breakdown');
    
    if (recentScansTitle) recentScansTitle.style.display = 'flex';
    if (recentScansCard) recentScansCard.style.display = 'block';
    if (classroomBreakdown) classroomBreakdown.style.display = 'none';
    
    // Stats indicators
    document.getElementById('dash-stat-enrolled').textContent = stats.enrolled;
    document.getElementById('dash-stat-present').textContent = stats.present;
    document.getElementById('dash-stat-late').textContent = stats.late;
    document.getElementById('dash-stat-absent').textContent = stats.absent;
    document.getElementById('dash-stat-missing').textContent = stats.unscanned;

    // Render Recent Dashboard Scans Table (scans recorded TODAY for advisor's section only)
    const logs = Database.getAttendanceByDate(dateToday).filter(l => l.session === sessionFilter);
    const tbody = document.getElementById('dash-recent-scans-tbody');
    tbody.innerHTML = '';
    
    const students = Database.getStudents().filter(s => s.grade_section === userSection);
    const sectionLogs = logs.filter(l => students.some(s => s.id === l.student_id));
    
    // Filter and sort scans recorded today, newest first
    const checkedInLogs = sectionLogs
      .filter(l => l.status === 'PRESENT' || l.status === 'ABSENT')
      .reverse();

    if (checkedInLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">No scans recorded yet for today's session. Click "Start Session" to open reader.</td></tr>`;
      return;
    }

    checkedInLogs.slice(0, 5).forEach(log => {
      const student = Database.getStudentById(log.student_id);
      if (!student) return;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="student-cell">
            <img class="student-avatar" src="${student.photo_path || 'assets/photos/student_mateo.png'}">
            <div class="student-meta">
              <span class="student-name">${student.full_name}</span>
              <span class="student-desc">ID: ${student.student_number}</span>
            </div>
          </div>
        </td>
        <td><code style="font-weight: 700;">${student.rfid_uid || '---'}</code></td>
        <td>${log.time_in}</td>
        <td><span class="badge ${log.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}">${log.status}</span></td>
        <td><span class="badge ${log.synced ? 'badge-synced' : 'badge-unsynced'}">${log.synced ? 'Synced' : 'Local'}</span></td>
      `;
      tbody.appendChild(row);
    });
  },

  renderStudents() {
    const activeUser = Database.getActiveUser();
    const gradeFilter = document.getElementById('students-grade-filter');
    
    // Check if showing active or archived roster
    const rosterViewEl = document.getElementById('students-roster-view');
    const isArchivedView = rosterViewEl ? rosterViewEl.value === 'archived' : false;

    const students = Database.getStudents(isArchivedView);
    
    // If advisor, restrict list to their assigned section only
    const sectionStudents = (activeUser && !activeUser.is_principal)
      ? students.filter(s => s.grade_section === activeUser.section)
      : students;

    // Render Counts based on ACTIVE database students
    const activeStudents = Database.getStudents(false);
    const sectionActive = (activeUser && !activeUser.is_principal)
      ? activeStudents.filter(s => s.grade_section === activeUser.section)
      : activeStudents;

    const total = sectionActive.length;
    const rfidActive = sectionActive.filter(s => s.rfid_uid).length;
    const pending = total - rfidActive;

    document.getElementById('stud-stat-total').textContent = total;
    document.getElementById('stud-stat-active').textContent = rfidActive;
    document.getElementById('stud-stat-pending').textContent = pending;

    // Render Table rows
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterVal = gradeFilter ? gradeFilter.value : 'All Grades';
    const searchVal = document.getElementById('students-search-input').value.toLowerCase();

    let filtered = sectionStudents;
    if (filterVal !== 'All Grades' && (activeUser && activeUser.is_principal)) {
      filtered = filtered.filter(s => s.grade_section === filterVal);
    }
    if (searchVal) {
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(searchVal) || s.student_number.includes(searchVal));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">${isArchivedView ? 'No archived student profiles found.' : 'No matching student profiles found.'}</td></tr>`;
      return;
    }

    filtered.forEach(student => {
      const row = document.createElement('tr');
      const hasRfid = !!student.rfid_uid;
      const rfidBadge = hasRfid 
        ? `<span class="badge badge-present" style="font-size: 9px;"><span class="material-symbols-outlined" style="font-size:12px;">contactless</span> ${student.rfid_uid}</span>`
        : `<span class="badge badge-late" style="font-size: 9px;">Not Linked</span>`;

      let actionButtons = '';
      if (student.is_archived) {
        actionButtons = `
          <button class="btn-table-action" onclick="App.handleRestoreStudent('${student.id}')" title="Restore Student">
            <span class="material-symbols-outlined">undo</span>
          </button>
          <button class="btn-table-action delete" onclick="App.handlePermanentDeleteStudent('${student.id}')" title="Delete Forever">
            <span class="material-symbols-outlined">delete_forever</span>
          </button>
        `;
      } else {
        actionButtons = `
          <button class="btn-table-action" onclick="App.openRfidRegistration('${student.id}')" title="Link RFID Card">
            <span class="material-symbols-outlined">contactless</span>
          </button>
          <button class="btn-table-action edit" onclick="App.openEditStudentModal('${student.id}')" title="Edit Profile">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="btn-table-action delete" onclick="App.handleDeleteStudent('${student.id}')" title="Archive Profile">
            <span class="material-symbols-outlined">archive</span>
          </button>
        `;
      }

      row.innerHTML = `
        <td>
          <div class="student-cell">
            <img class="student-avatar" src="${student.photo_path || 'assets/photos/student_mateo.png'}">
            <div class="student-meta">
              <span class="student-name">${student.full_name}</span>
              <span class="student-desc">Guardian: ${student.guardian_name} (${student.relationship})</span>
            </div>
          </div>
        </td>
        <td><code>${student.student_number}</code></td>
        <td><span class="badge ${student.gender === 'F' ? 'badge-present' : 'badge-synced'}" style="font-size: 11px; padding: 4px 8px; font-weight: 700;">${student.gender === 'F' ? 'Female' : 'Male'}</span></td>
        <td>${student.grade_section}</td>
        <td>${rfidBadge}</td>
        <td>
          <div class="row-actions-btn-group">
            ${actionButtons}
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('students-pagination-text').textContent = `Showing 1 to ${filtered.length} of ${filtered.length} students`;
  },

  renderRecords(dateToday) {
    const activeUser = Database.getActiveUser();
    const recordFilter = document.getElementById('records-grade-filter');
    if (activeUser && !activeUser.is_principal) {
      if (recordFilter) {
        recordFilter.value = activeUser.section;
        recordFilter.disabled = true;
      }
    } else if (recordFilter && recordFilter.disabled) {
      recordFilter.disabled = false;
    }

    const students = Database.getStudents();
    
    // Use selected date filter or default today
    const dateInput = document.getElementById('records-date-filter');
    const selectedDate = dateInput.value || dateToday;
    if (!dateInput.value) dateInput.value = selectedDate;

    // Get selected session filter
    const selectedSession = document.getElementById('records-session-filter') ? document.getElementById('records-session-filter').value : 'AM';

    // Get analytics for that day (section-specific if advisor)
    const stats = Database.getAnalytics(selectedDate, (activeUser && !activeUser.is_principal) ? activeUser.section : undefined, selectedSession);
    document.getElementById('rec-stat-avg').textContent = `${stats.avgAttendance}%`;
    document.getElementById('rec-stat-ratio').textContent = `${stats.present + stats.late}/${stats.enrolled}`;
    document.getElementById('rec-stat-late').textContent = stats.late.toString().padStart(2, '0');
    document.getElementById('rec-stat-absent').textContent = stats.absent.toString().padStart(2, '0');

    // Filter logs
    const logs = Database.getAttendanceByDate(selectedDate).filter(l => l.session === selectedSession);
    const tbody = document.getElementById('records-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterStatus = document.getElementById('records-status-filter').value;
    const filterSection = recordFilter ? recordFilter.value : 'All';

    students.forEach(student => {
      // Security: ensure advisors can only see their own class records
      if (activeUser && !activeUser.is_principal && student.grade_section !== activeUser.section) return;
      if (filterSection !== 'All' && student.grade_section !== filterSection) return;

      const log = logs.find(l => l.student_id === student.id);
      
      let status = 'ABSENT';
      let timeIn = '--:-- --';
      let method = 'No Entry';
      let synced = true;

      if (log) {
        status = log.status;
        timeIn = log.time_in;
        method = log.method;
        synced = log.synced;
      }

      if (filterStatus !== 'All' && status !== filterStatus) return;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="student-cell">
            <img class="student-avatar" src="${student.photo_path || 'assets/photos/student_mateo.png'}">
            <div class="student-meta">
              <span class="student-name">${student.full_name}</span>
              <span class="student-desc">${student.grade_section}</span>
            </div>
          </div>
        </td>
        <td><code>${student.student_number}</code></td>
        <td>${timeIn}</td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:16px;">${method === 'RFID Scan' ? 'contactless' : method === 'Manual Entry' ? 'edit_square' : 'block'}</span>
            ${method}
          </span>
        </td>
        <td><span class="badge ${status === 'PRESENT' ? 'badge-present' : 'badge-absent'}">${status}</span></td>
        <td>
          <button class="btn-table-action" onclick="App.openManualEntryModal('${student.id}', '${selectedDate}')" title="Manual Check-in">
            <span class="material-symbols-outlined">edit_square</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  renderSettings() {
    const settings = Database.getSettings();
    const activeUser = Database.getActiveUser();
    const isPrincipal = activeUser && activeUser.is_principal;

    // Populate AM settings
    document.getElementById('settings-am-start-time').value = settings.amStartTime || '07:30';
    document.getElementById('settings-am-late-min').value = settings.amLateMin || '07:45';
    document.getElementById('settings-am-late-max').value = settings.amLateMax || '08:30';
    document.getElementById('settings-am-deadline').value = settings.amDeadline || '09:30';

    // Populate PM settings
    document.getElementById('settings-pm-start-time').value = settings.pmStartTime || '13:00';
    document.getElementById('settings-pm-late-min').value = settings.pmLateMin || '13:15';
    document.getElementById('settings-pm-late-max').value = settings.pmLateMax || '14:00';
    document.getElementById('settings-pm-deadline').value = settings.pmDeadline || '15:00';

    // Common settings
    document.getElementById('settings-sync-url').value = settings.serverSyncUrl;
    document.getElementById('settings-mock-sync').checked = settings.mockServerMode;

    // Disable editing settings rules form if logged-in user is not the Principal
    const rulesForm = document.getElementById('settings-rules-form');
    if (rulesForm) {
      const inputs = rulesForm.querySelectorAll('input, select');
      inputs.forEach(el => {
        el.disabled = !isPrincipal;
      });
      const submitBtn = document.getElementById('settings-rules-submit-btn');
      if (submitBtn) {
        if (!isPrincipal) {
          submitBtn.style.display = 'none';
        } else {
          submitBtn.style.display = 'block';
        }
      }
    }

    // Populate Firebase settings if config exists
    const fbConfigStr = localStorage.getItem('malaiba_firebase_config');
    if (fbConfigStr) {
      try {
        const config = JSON.parse(fbConfigStr);
        document.getElementById('fb-api-key').value = config.apiKey || '';
        document.getElementById('fb-auth-domain').value = config.authDomain || '';
        document.getElementById('fb-project-id').value = config.projectId || '';
        document.getElementById('fb-storage-bucket').value = config.storageBucket || '';
        document.getElementById('fb-messaging-id').value = config.messagingSenderId || '';
        document.getElementById('fb-app-id').value = config.appId || '';
      } catch (err) {
        console.warn("Failed to parse stored Firebase config:", err);
      }
    } else {
      document.getElementById('fb-api-key').value = '';
      document.getElementById('fb-auth-domain').value = '';
      document.getElementById('fb-project-id').value = '';
      document.getElementById('fb-storage-bucket').value = '';
      document.getElementById('fb-messaging-id').value = '';
      document.getElementById('fb-app-id').value = '';
    }
    
    const calendarCard = document.getElementById('settings-calendar-card');
    if (calendarCard) {
      calendarCard.style.display = isPrincipal ? 'block' : 'none';
      if (isPrincipal) {
        const monthSelect = document.getElementById('calendar-month-select');
        const yearSelect = document.getElementById('calendar-year-select');
        const now = new Date();
        if (monthSelect && !monthSelect.value) {
          monthSelect.value = now.getMonth();
        }
        if (yearSelect && !yearSelect.value) {
          yearSelect.value = now.getFullYear();
        }
        this.renderCalendarConfig();
      }
    }

    const principalProfileCard = document.getElementById('settings-principal-profile-card');
    if (principalProfileCard) {
      principalProfileCard.style.display = isPrincipal ? 'block' : 'none';
      if (isPrincipal) {
        document.getElementById('settings-principal-name').value = activeUser.display_name;
      }
    }

    this.renderSectionsList();
  },

  // Calendar Configuration Helpers
  getDefaultClassDays(year, month) {
    const days = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dw = dateObj.getDay();
      if (dw !== 0 && dw !== 6) {
        days.push(d);
      }
    }
    return days;
  },

  renderCalendarConfig() {
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (!monthSelect || !yearSelect) return;

    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);
    const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

    const settings = Database.getSettings();
    if (!settings.classDays) {
      settings.classDays = {};
    }
    
    if (!settings.classDays[monthKey]) {
      this.currentCalendarDays = this.getDefaultClassDays(year, month);
    } else {
      this.currentCalendarDays = [...settings.classDays[monthKey]];
    }

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.style.aspectRatio = '1';
      emptySlot.style.visibility = 'hidden';
      grid.appendChild(emptySlot);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dw = dateObj.getDay();
      const isWeekend = dw === 0 || dw === 6;

      const cell = document.createElement('div');
      cell.style.aspectRatio = '1';
      
      if (isWeekend) {
        cell.className = 'calendar-cell weekend';
        cell.innerHTML = `
          <span style="font-size: 13px; font-weight: 700;">${d}</span>
          <span style="font-size: 9px; font-weight: 500; text-transform: uppercase; margin-top: 2px; color: var(--text-muted);">WE</span>
        `;
      } else {
        const isActive = this.currentCalendarDays.includes(d);
        cell.className = `calendar-cell weekday ${isActive ? 'active' : 'inactive'}`;
        cell.id = `cal-day-${d}`;
        cell.onclick = () => App.toggleCalendarDay(d);
        cell.innerHTML = `
          <span style="font-size: 13px; font-weight: 700;">${d}</span>
          <span class="day-status-label" style="font-size: 9px; font-weight: 600; text-transform: uppercase; margin-top: 2px;">
            ${isActive ? 'Class' : 'No Class'}
          </span>
        `;
      }
      grid.appendChild(cell);
    }
  },

  toggleCalendarDay(day) {
    if (!this.currentCalendarDays) return;
    const index = this.currentCalendarDays.indexOf(day);
    if (index !== -1) {
      this.currentCalendarDays.splice(index, 1);
    } else {
      this.currentCalendarDays.push(day);
    }
    
    const cell = document.getElementById(`cal-day-${day}`);
    if (cell) {
      const isActive = this.currentCalendarDays.includes(day);
      cell.className = `calendar-cell weekday ${isActive ? 'active' : 'inactive'}`;
      const label = cell.querySelector('.day-status-label');
      if (label) {
        label.textContent = isActive ? 'Class' : 'No Class';
      }
    }
  },

  saveCalendarConfig() {
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (!monthSelect || !yearSelect || !this.currentCalendarDays) return;

    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);
    const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

    const settings = Database.getSettings();
    if (!settings.classDays) {
      settings.classDays = {};
    }
    
    this.currentCalendarDays.sort((a, b) => a - b);
    settings.classDays[monthKey] = this.currentCalendarDays;

    Database.saveSettings(settings);
    this.showToast('Class calendar saved and updated successfully!');
    Sounds.playSuccess();
    
    if (this.isOnline && !this.isMockOffline) {
      this.triggerAutoSync();
    }
  },

  savePrincipalProfileName(newName) {
    const activeUser = Database.getActiveUser();
    if (!activeUser || !activeUser.is_principal) return;

    activeUser.display_name = newName.trim();
    
    Database.saveUser(activeUser);
    
    localStorage.setItem('malaiba_active_user', JSON.stringify(activeUser));
    
    this.updateProfileUI(activeUser);
    
    this.showToast('Profile name updated successfully!');
    Sounds.playSuccess();
    
    if (this.isOnline && !this.isMockOffline) {
      this.triggerAutoSync();
    }
  },

  // Active Session Sub-renderers
  renderSessionArrivals() {
    const scroller = document.getElementById('recent-scans-scroller');
    if (!scroller) return;

    scroller.innerHTML = '';
    if (this.recentScans.length === 0) {
      scroller.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 32px; font-weight: 500;">Waiting for taps...</div>`;
      return;
    }

    this.recentScans.forEach(scan => {
      const item = document.createElement('div');
      item.className = 'recent-scan-item';
      
      const badgeIcon = scan.status === 'ABSENT' ? 'cancel' : 'check_circle';
      const badgeClass = scan.status === 'ABSENT' ? 'icon-status icon-absent' : 'icon-status icon-present';

      item.innerHTML = `
        <img src="${scan.photo_path || 'assets/photos/student_mateo.png'}">
        <div class="recent-scan-details">
          <span class="recent-scan-name">${scan.name}</span>
          <span class="recent-scan-time">${scan.time_in} • ${scan.status}</span>
        </div>
        <span class="material-symbols-outlined ${badgeClass}">${badgeIcon}</span>
      `;
      scroller.appendChild(item);
    });
  },

  renderSessionStats() {
    const stats = Database.getAnalytics(this.sessionDate, undefined, this.sessionType);
    
    // Lobby widgets
    const pCount = document.getElementById('session-lobby-present-count');
    const lCount = document.getElementById('session-lobby-late-count');
    if (pCount) pCount.textContent = `${stats.present} Present`;
    if (lCount) lCount.textContent = `${stats.late} Late`;

    // Confirmation screen sidebar widgets
    const presentSide = document.getElementById('session-confirmed-present-count');
    const lateSide = document.getElementById('session-confirmed-late-count');
    const absentSide = document.getElementById('session-confirmed-absent-count');
    const ratioSide = document.getElementById('session-confirmed-ratio');

    if (presentSide) presentSide.textContent = stats.present;
    if (lateSide) lateSide.textContent = stats.late;
    if (absentSide) absentSide.textContent = stats.absent;
    if (ratioSide) ratioSide.textContent = `${stats.present}/${stats.enrolled}`;
  },

  renderSession() {
    const setupView = document.getElementById('session-setup-view');
    const activeLayout = document.getElementById('session-active-layout');
    
    if (this.sessionActive) {
      if (setupView) setupView.style.display = 'none';
      if (activeLayout) activeLayout.style.display = 'grid';
      
      if (this.sessionDate) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = new Date(this.sessionDate).toLocaleDateString('en-US', options);
        document.querySelectorAll('.session-date-display').forEach(el => {
          el.textContent = formattedDate;
        });
      }
      
      this.renderSessionArrivals();
      this.renderSessionStats();
    } else {
      if (setupView) setupView.style.display = 'block';
      if (activeLayout) activeLayout.style.display = 'none';
      
      const datePicker = document.getElementById('session-date-picker');
      if (datePicker && !datePicker.value) {
        datePicker.value = new Date().toISOString().split('T')[0];
      }
    }
  },

  // 7. FORM SUBMISSIONS & MODALS CREATION
  handleLogin(username, password) {
    const user = Database.login(username, password);
    if (user) {
      this.updateProfileUI(user);
      if (user.needs_password_reset) {
        this.switchScreen('password-reset');
        this.showToast('First-time login: Please reset your password.');
      } else {
        this.adaptSidebarForRole(user);
        this.switchScreen('dashboard');
        this.showToast(`Login Successful! Welcome, ${user.is_principal ? 'Principal' : 'Advisor'}.`);
      }
      Sounds.playSuccess();
    } else {
      Sounds.playError();
      alert('Invalid username or password. (Principal: principal / password | Advisor: admin / password)');
    }
  },

  handleLogout() {
    Database.logout();
    this.sessionActive = false;
    
    // Reset sidebar elements to default
    const navStudents = document.getElementById('nav-students');
    const navTeachers = document.getElementById('nav-teachers');
    const portalSubtitle = document.getElementById('portal-subtitle');
    if (navStudents) navStudents.style.display = 'flex';
    if (navTeachers) navTeachers.style.display = 'none';
    if (portalSubtitle) portalSubtitle.textContent = 'Malaiba ES • Advisor Portal';
    
    this.switchScreen('login');
    this.showToast('Logged Out Successfully');
    Sounds.playWarning();
  },

  openAddStudentModal() {
    document.getElementById('student-modal-title').textContent = 'Add New Student Profile';
    document.getElementById('student-form-id').value = '';
    document.getElementById('student-form-number').value = '';
    document.getElementById('student-form-name').value = '';
    document.getElementById('student-form-section').value = 'Grade 3 - Narra';
    document.getElementById('student-form-gender').value = 'M';
    document.getElementById('student-form-guardian').value = '';
    document.getElementById('student-form-contact').value = '';
    document.getElementById('student-form-relation').value = 'Mother';
    
    // Reset file input and tracking state
    const fileInput = document.getElementById('student-form-photo-input');
    if (fileInput) fileInput.value = '';
    this.activeStudentPhoto = '';
    
    // Clear preview image
    const preview = document.getElementById('student-avatar-img-preview');
    const placeholder = document.getElementById('student-avatar-placeholder');
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    if (placeholder) {
      placeholder.style.display = 'flex';
    }

    document.getElementById('student-modal').classList.add('active');
  },

  openEditStudentModal(studentId) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    document.getElementById('student-modal-title').textContent = 'Edit Student Profile';
    document.getElementById('student-form-id').value = student.id;
    document.getElementById('student-form-number').value = student.student_number;
    document.getElementById('student-form-name').value = student.full_name;
    document.getElementById('student-form-section').value = student.grade_section;
    document.getElementById('student-form-gender').value = student.gender || 'M';
    document.getElementById('student-form-guardian').value = student.guardian_name;
    document.getElementById('student-form-contact').value = student.contact_number;
    document.getElementById('student-form-relation').value = student.relationship;

    // Reset file input
    const fileInput = document.getElementById('student-form-photo-input');
    if (fileInput) fileInput.value = '';

    // Show preview photo if exists
    const preview = document.getElementById('student-avatar-img-preview');
    const placeholder = document.getElementById('student-avatar-placeholder');
    
    if (student.photo_path) {
      preview.src = student.photo_path;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      this.activeStudentPhoto = student.photo_path;
    } else {
      preview.style.display = 'none';
      placeholder.style.display = 'flex';
      this.activeStudentPhoto = '';
    }

    document.getElementById('student-modal').classList.add('active');
  },

  closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
  },

  handleStudentPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file.');
      Sounds.playError();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale image to max 256x256 px to optimize localStorage/DB footprint
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG representation
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        this.activeStudentPhoto = optimizedBase64;

        const preview = document.getElementById('student-avatar-img-preview');
        const placeholder = document.getElementById('student-avatar-placeholder');
        if (preview && placeholder) {
          preview.src = optimizedBase64;
          preview.style.display = 'block';
          placeholder.style.display = 'none';
        }

        this.showToast('Student photo uploaded and optimized!');
        Sounds.playSuccess();
      };
      img.onerror = () => {
        this.showToast('Failed to load image file.');
        Sounds.playError();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  saveStudentProfile(formData) {
    // Determine photo path: use custom uploaded photo if available, fallback to mock name matching
    let photo = this.activeStudentPhoto || '';
    if (!photo) {
      photo = 'assets/photos/student_mateo.png'; // default fallback
      const nameLower = formData.full_name.toLowerCase();
      
      if (nameLower.includes('elena')) photo = 'assets/photos/student_elena.png';
      else if (nameLower.includes('mateo')) photo = 'assets/photos/student_mateo.png';
      else if (nameLower.includes('sofia')) photo = 'assets/photos/student_sofia.png';
      else if (nameLower.includes('julian')) photo = 'assets/photos/student_julian.png';
    }

    const saved = Database.saveStudent({
      id: formData.id || undefined,
      student_number: formData.student_number,
      full_name: formData.full_name,
      grade_section: formData.grade_section,
      gender: formData.gender,
      guardian_name: formData.guardian_name,
      contact_number: formData.contact_number,
      relationship: formData.relationship,
      photo_path: photo
    });

    this.closeStudentModal();
    this.renderScreen('students');
    this.showToast(formData.id ? 'Student Profile Updated!' : 'New Student Registered Successfully!');
    Sounds.playSuccess();
  },

  handleDeleteStudent(studentId) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    this.showConfirm(
      'Archive Student Profile',
      `Are you sure you want to archive the student profile of ${student.full_name}? They will be hidden from the active roster but their historical records will be preserved.`,
      'archive',
      'var(--status-late)',
      () => {
        Database.archiveStudent(studentId);
        this.renderScreen('students');
        this.showToast('Student profile moved to archive.');
        Sounds.playWarning();
      }
    );
  },

  openManualEntryModal(studentId, date) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    document.getElementById('manual-entry-student-id').value = studentId;
    document.getElementById('manual-entry-date').value = date;
    document.getElementById('manual-entry-title').textContent = `Manual Check-In: ${student.full_name}`;
    
    // Preset session type select
    const recordsSessionFilter = document.getElementById('records-session-filter');
    if (recordsSessionFilter && document.getElementById('manual-entry-session')) {
      document.getElementById('manual-entry-session').value = recordsSessionFilter.value;
    }

    // Default values
    document.getElementById('manual-entry-time').value = '07:30';
    document.getElementById('manual-entry-status').value = 'PRESENT';

    document.getElementById('manual-entry-modal').classList.add('active');
  },

  closeManualEntryModal() {
    document.getElementById('manual-entry-modal').classList.remove('active');
  },

  submitManualCheckin(studentId, date, session, time, status) {
    const isActuallyConnected = this.isOnline && !this.isMockOffline;
    
    // Format time from 24h to 12h
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const formattedTime = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;

    Database.saveAttendanceRecord({
      student_id: studentId,
      date: date,
      session: session,
      time_in: formattedTime,
      status: status,
      method: 'Manual Entry',
      synced: isActuallyConnected
    });

    this.updatePendingSyncCount();
    this.closeManualEntryModal();

    // Set records filter dropdown to match session type we just edited
    const recordsSessionFilter = document.getElementById('records-session-filter');
    if (recordsSessionFilter) {
      recordsSessionFilter.value = session;
    }

    this.renderScreen('records');
    this.showToast('Manual check-in recorded.');
    Sounds.playSuccess();
    
    if (isActuallyConnected) {
      this.triggerAutoSync();
    }
  },

  saveSettingsRules(rules) {
    Database.saveSettings(rules);
    this.showToast('Attendance settings updated successfully.');
    Sounds.playSuccess();
    this.renderScreen('settings');
  },

  saveFirebaseConfig(config) {
    try {
      localStorage.setItem('malaiba_firebase_config', JSON.stringify(config));
      Database.initFirebase(); // reinitialize database with new config
      this.showToast('Firebase Cloud configuration saved successfully.');
      Sounds.playSuccess();
      this.renderScreen('settings');
    } catch (err) {
      console.error(err);
      this.showToast('Failed to save configuration.');
      Sounds.playError();
    }
  },

  clearFirebaseConfig() {
    this.showConfirm(
      'Disconnect Cloud Database',
      'Are you sure you want to disconnect from Firebase Cloud? Local caching will remain, but synchronization will stop.',
      'cloud_off',
      'var(--status-absent)',
      () => {
        localStorage.removeItem('malaiba_firebase_config');
        Database.disconnectFirebase();
        this.showToast('Disconnected from Firebase Cloud.');
        Sounds.playWarning();
        this.renderScreen('settings');
      }
    );
  },

  handleResetDatabase() {
    this.showConfirm(
      'Reset Entire Database',
      'CRITICAL WARNING: This will delete ALL registered student profiles, linked RFID cards, and attendance histories. The database will be reseeded with defaults. Do you want to continue?',
      'delete_sweep',
      'var(--status-absent)',
      () => {
        Database.reset();
        this.showToast('Database reset to defaults.');
        Sounds.playWarning();
        
        if (this.currentScreen !== 'login') {
          this.switchScreen('dashboard');
        }
      }
    );
  },

  // 8. NOTIFICATION UTILS
  showToast(message) {
    const toast = document.getElementById('toast-msg');
    const toastText = document.getElementById('toast-msg-text');
    
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.add('active');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 3500);
  },

  showConfirm(title, message, icon, confirmColor, onConfirm) {
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    const iconEl = document.getElementById('confirm-modal-icon');
    if (iconEl) iconEl.textContent = icon || 'warning';
    
    const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.style.backgroundColor = confirmColor || 'var(--status-absent)';
      
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      
      newConfirmBtn.addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('active');
        if (onConfirm) onConfirm();
      });
    }

    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('active');
      });
    }

    document.getElementById('confirm-modal').classList.add('active');
  },

  // Password reset helper
  handlePasswordReset(newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      Sounds.playError();
      alert('Passwords do not match.');
      return;
    }
    
    const activeUser = Database.getActiveUser();
    if (!activeUser) {
      this.switchScreen('login');
      return;
    }

    const success = Database.changePassword(activeUser.username, newPassword);
    if (success) {
      Sounds.playSuccess();
      this.showToast('Password updated successfully!');
      
      const updatedUser = Database.getActiveUser();
      this.updateProfileUI(updatedUser);
      this.adaptSidebarForRole(updatedUser);
      this.switchScreen('dashboard');
    } else {
      Sounds.playError();
      alert('Failed to update password.');
    }
  },

  // Principal Dashboard Render helper
  renderPrincipalDashboard(dateToday) {
    this.currentDashboardDate = dateToday;
    const sessionFilter = document.getElementById('dashboard-session-filter') ? document.getElementById('dashboard-session-filter').value : 'AM';
    const stats = Database.getSchoolAnalytics(dateToday, sessionFilter);
    
    const titleText = document.getElementById('dashboard-title-text');
    const subtitleText = document.getElementById('dashboard-subtitle-text');
    
    if (titleText) titleText.textContent = 'School Overview';
    if (subtitleText) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = new Date(dateToday).toLocaleDateString('en-US', options);
      subtitleText.textContent = `${formattedDate} • School-wide Attendance • ${sessionFilter === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}`;
    }
    
    document.getElementById('dash-stat-enrolled').textContent = stats.overall.enrolled;
    document.getElementById('dash-stat-present').textContent = stats.overall.present;
    document.getElementById('dash-stat-late').textContent = stats.overall.late;
    document.getElementById('dash-stat-absent').textContent = stats.overall.absent;
    document.getElementById('dash-stat-missing').textContent = stats.overall.unscanned;

    const recentScansTitle = document.getElementById('dash-recent-scans-title');
    const recentScansCard = document.getElementById('dash-recent-scans-card');
    const classroomBreakdown = document.getElementById('principal-classroom-breakdown');
    
    if (recentScansTitle) recentScansTitle.style.display = 'none';
    if (recentScansCard) recentScansCard.style.display = 'none';
    if (classroomBreakdown) classroomBreakdown.style.display = 'block';

    const gridContainer = document.getElementById('classroom-grid-container');
    if (gridContainer) {
      gridContainer.innerHTML = '';
      stats.sections.forEach(sec => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '16px';
        card.style.padding = '24px';
        card.style.border = '1px solid var(--outline-variant)';
        card.style.borderRadius = 'var(--radius-lg)';
        card.style.backgroundColor = 'var(--surface)';
        card.style.boxShadow = 'var(--shadow-sm)';
        
        let statusText = 'Excellent';
        let statusClass = 'badge-present';
        if (sec.attendanceRateToday < 85) {
          statusText = 'Needs Attention';
          statusClass = 'badge-absent';
        } else if (sec.attendanceRateToday < 93) {
          statusText = 'On Track';
          statusClass = 'badge-late';
        }
        
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 style="font-size: 16px; font-weight: 800; color: var(--text-primary);">${sec.section}</h4>
              <p style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">Advisor: ${sec.advisorName}</p>
            </div>
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          
          <div style="margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <span style="font-size: 28px; font-weight: 800; color: var(--primary);">${sec.attendanceRateToday}%</span>
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Today's Rate</span>
            </div>
            <div style="width: 100%; height: 8px; background-color: var(--surface-container); border-radius: var(--radius-full); overflow: hidden;">
              <div style="width: ${sec.attendanceRateToday}%; height: 100%; background-color: ${sec.attendanceRateToday < 85 ? 'var(--status-absent)' : sec.attendanceRateToday < 93 ? 'var(--status-late)' : 'var(--status-present)'}; border-radius: var(--radius-full);"></div>
            </div>
          </div>
          
          <div style="display: flex; gap: 12px; border-top: 1px solid var(--outline-variant); padding-top: 12px; margin-top: 4px;">
            <div style="flex: 1; text-align: center;">
              <span style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Enrolled</span>
              <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${sec.enrolled}</span>
            </div>
            <div style="flex: 1; text-align: center; border-left: 1px solid var(--outline-variant);">
              <span style="display: block; font-size: 10px; color: var(--status-present); font-weight: 700; text-transform: uppercase;">Present</span>
              <span style="font-size: 14px; font-weight: 700; color: var(--status-present);">${sec.present + sec.late}</span>
            </div>
            <div style="flex: 1; text-align: center; border-left: 1px solid var(--outline-variant);">
              <span style="display: block; font-size: 10px; color: var(--status-absent); font-weight: 700; text-transform: uppercase;">Absent</span>
              <span style="font-size: 14px; font-weight: 700; color: var(--status-absent);">${sec.absent}</span>
            </div>
          </div>
        `;
        gridContainer.appendChild(card);
      });
    }
  },

  // Teacher Management rendering logic
  renderTeachers() {
    const users = Database.getUsers();
    const teachers = users.filter(u => !u.is_principal);
    
    const totalTeachers = teachers.length;
    const pendingReset = teachers.filter(t => t.needs_password_reset).length;
    const activePasswords = totalTeachers - pendingReset;
    
    const tTotal = document.getElementById('teacher-stat-total');
    const tActive = document.getElementById('teacher-stat-active');
    const tPending = document.getElementById('teacher-stat-pending');
    if (tTotal) tTotal.textContent = totalTeachers;
    if (tActive) tActive.textContent = activePasswords;
    if (tPending) tPending.textContent = pendingReset;
    
    const tbody = document.getElementById('teachers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const searchInput = document.getElementById('teachers-search-input');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filtered = teachers;
    if (searchVal) {
      filtered = filtered.filter(t => 
        t.display_name.toLowerCase().includes(searchVal) || 
        t.username.toLowerCase().includes(searchVal)
      );
    }
    
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">No advisor accounts found. Click "Add New Teacher" to create one.</td></tr>`;
      return;
    }
    
    filtered.forEach(teacher => {
      const row = document.createElement('tr');
      const passBadge = teacher.needs_password_reset
        ? `<span class="badge badge-late" style="font-size: 10px; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size:12px;">lock</span> Temporary Password</span>`
        : `<span class="badge badge-present" style="font-size: 10px; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size:12px;">check_circle</span> Password Active</span>`;
        
      row.innerHTML = `
        <td>
          <div class="student-cell">
            <img class="student-avatar" src="${teacher.photo_path || 'assets/photos/teacher_santos.png'}">
            <div class="student-meta">
              <span class="student-name">${teacher.display_name}</span>
              <span class="student-desc">${teacher.role}</span>
            </div>
          </div>
        </td>
        <td><code>${teacher.username}</code></td>
        <td>${teacher.section || 'Unassigned'}</td>
        <td>${passBadge}</td>
        <td>
          <div class="row-actions-btn-group">
            <button class="btn-table-action" onclick="App.openEditTeacherModal('${teacher.username}')" title="Edit Teacher">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-table-action delete" onclick="App.handleDeleteTeacher('${teacher.username}')" title="Delete Account" ${teacher.username === 'admin' ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  // Modals for Teachers
  openAddTeacherModal() {
    this.populateSectionDropdowns();
    document.getElementById('teacher-modal-title').textContent = 'Create Teacher Account';
    document.getElementById('teacher-form-name').value = '';
    
    const roleSelect = document.getElementById('teacher-form-role');
    if (roleSelect) roleSelect.selectedIndex = 0;
    
    const secSelect = document.getElementById('teacher-form-section');
    if (secSelect) secSelect.selectedIndex = 0;
    
    document.getElementById('teacher-form-username').value = '';
    document.getElementById('teacher-form-username').disabled = false;
    document.getElementById('teacher-form-password').value = '';
    document.getElementById('teacher-password-group').style.display = 'block';
    
    document.getElementById('teacher-modal').classList.add('active');
  },

  openEditTeacherModal(username) {
    this.populateSectionDropdowns(username);
    const users = Database.getUsers();
    const teacher = users.find(u => u.username === username.toLowerCase());
    if (!teacher) return;
    
    document.getElementById('teacher-modal-title').textContent = 'Edit Advisor Profile';
    document.getElementById('teacher-form-name').value = teacher.display_name;
    
    const roleSelect = document.getElementById('teacher-form-role');
    if (roleSelect) roleSelect.value = teacher.role || 'Grade 3 Adviser';
    
    const secSelect = document.getElementById('teacher-form-section');
    if (secSelect) secSelect.value = teacher.section || '';
    
    document.getElementById('teacher-form-username').value = teacher.username;
    document.getElementById('teacher-form-username').disabled = true;
    document.getElementById('teacher-form-password').value = '********';
    document.getElementById('teacher-password-group').style.display = 'none';
    
    document.getElementById('teacher-modal').classList.add('active');
  },

  closeTeacherModal() {
    document.getElementById('teacher-modal').classList.remove('active');
  },

  saveTeacherProfile(formData) {
    const isEditing = document.getElementById('teacher-form-username').disabled;
    const users = Database.getUsers();
    
    // Section Adviser Uniqueness Constraint
    const cleanSection = formData.section ? formData.section.trim() : '';
    if (cleanSection) {
      const assignedUser = users.find(u => !u.is_principal && u.section === cleanSection && u.username !== formData.username.toLowerCase());
      if (assignedUser) {
        Sounds.playError();
        alert(`Section "${cleanSection}" is already assigned to adviser ${assignedUser.display_name}.`);
        return;
      }
    }

    if (!isEditing) {
      const existing = users.find(u => u.username === formData.username.toLowerCase());
      if (existing) {
        Sounds.playError();
        alert('Username is already taken by another teacher.');
        return;
      }
      
      Database.saveUser({
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name,
        role: formData.role,
        section: formData.section,
        needs_password_reset: true,
        is_principal: false,
        photo_path: 'assets/photos/teacher_santos.png'
      });
      this.showToast('Teacher account created successfully!');
    } else {
      const existingUser = users.find(u => u.username === formData.username.toLowerCase());
      if (existingUser) {
        Database.saveUser({
          ...existingUser,
          display_name: formData.display_name,
          role: formData.role,
          section: formData.section
        });
        this.showToast('Teacher profile updated.');
      }
    }
    
    this.closeTeacherModal();
    this.renderTeachers();
    Sounds.playSuccess();
  },

  handleDeleteTeacher(username) {
    if (username === 'admin') {
      alert('Cannot delete the main default advisor account.');
      return;
    }
    
    this.showConfirm(
      'Delete Teacher Account',
      `Are you sure you want to permanently delete the teacher account for "${username}"?`,
      'delete',
      'var(--status-absent)',
      () => {
        Database.deleteUser(username);
        this.renderTeachers();
        this.showToast('Teacher account deleted.');
        Sounds.playWarning();
      }
    );
  },

  handleRestoreStudent(studentId) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    Database.restoreStudent(studentId);
    this.renderScreen('students');
    this.showToast('Student profile restored.');
    Sounds.playSuccess();
  },

  handlePermanentDeleteStudent(studentId) {
    const student = Database.getStudentById(studentId);
    if (!student) return;

    this.showConfirm(
      'Delete Profile Permanently',
      `CRITICAL WARNING: Are you sure you want to PERMANENTLY delete ${student.full_name}? This will delete all their historical attendance logs. This action cannot be undone.`,
      'delete_forever',
      'var(--status-absent)',
      () => {
        Database.deleteStudent(studentId);
        this.renderScreen('students');
        this.showToast('Student profile permanently deleted.');
        Sounds.playWarning();
      }
    );
  },

  populateSectionDropdowns(editingUsername = null) {
    const activeUser = Database.getActiveUser();
    if (!activeUser) return;

    const activeSections = Database.getSections();
    const students = Database.getStudents(true); // read all, including archived
    const users = Database.getUsers();
    
    const allExistingSections = [...activeSections].filter(Boolean).sort();

    const studFilter = document.getElementById('students-grade-filter');
    const recFilter = document.getElementById('records-grade-filter');
    const formSection = document.getElementById('student-form-section');
    const teacherFormSection = document.getElementById('teacher-form-section');

    if (activeUser.is_principal) {
      if (studFilter) {
        const currentVal = studFilter.value || 'All Grades';
        studFilter.innerHTML = '<option value="All Grades">All Sections</option>' +
          allExistingSections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
        studFilter.value = (allExistingSections.includes(currentVal) || currentVal === 'All Grades') ? currentVal : 'All Grades';
        studFilter.disabled = false;
      }
      if (recFilter) {
        const currentVal = recFilter.value || 'All';
        recFilter.innerHTML = '<option value="All">All Sections</option>' +
          allExistingSections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
        recFilter.value = (allExistingSections.includes(currentVal) || currentVal === 'All') ? currentVal : 'All';
        recFilter.disabled = false;
      }
      if (formSection) {
        const currentVal = formSection.value;
        formSection.innerHTML = activeSections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
        if (activeSections.includes(currentVal)) {
          formSection.value = currentVal;
        }
      }
      if (teacherFormSection) {
        const currentVal = teacherFormSection.value;
        const cleanEditingUsername = editingUsername ? editingUsername.toLowerCase() : '';
        
        teacherFormSection.innerHTML = '<option value="" disabled selected hidden>Choose Section...</option>' + 
          activeSections.map(sec => {
            const assignedUser = users.find(u => !u.is_principal && u.section === sec);
            if (assignedUser && assignedUser.username !== cleanEditingUsername) {
              return `<option value="${sec}" disabled>${sec} (Assigned: ${assignedUser.display_name})</option>`;
            } else if (assignedUser && assignedUser.username === cleanEditingUsername) {
              return `<option value="${sec}">${sec} (Currently Assigned)</option>`;
            } else {
              return `<option value="${sec}">${sec}</option>`;
            }
          }).join('');
          
        if (activeSections.includes(currentVal)) {
          teacherFormSection.value = currentVal;
        }
      }
    } else {
      const advisorSec = activeUser.section || 'Grade 3 - Narra';
      if (studFilter) {
        studFilter.innerHTML = `<option value="${advisorSec}">${advisorSec}</option>`;
        studFilter.value = advisorSec;
        studFilter.disabled = true;
      }
      if (recFilter) {
        recFilter.innerHTML = `<option value="${advisorSec}">${advisorSec}</option>`;
        recFilter.value = advisorSec;
        recFilter.disabled = true;
      }
      if (formSection) {
        formSection.innerHTML = `<option value="${advisorSec}">${advisorSec}</option>`;
        formSection.value = advisorSec;
      }
      if (teacherFormSection) {
        teacherFormSection.innerHTML = `<option value="${advisorSec}">${advisorSec}</option>`;
        teacherFormSection.value = advisorSec;
      }
    }
  },

  renderSectionsList() {
    const activeUser = Database.getActiveUser();
    const isPrincipal = activeUser && activeUser.is_principal;
    
    const sectionsCard = document.getElementById('settings-sections-card');
    if (sectionsCard) {
      sectionsCard.style.display = isPrincipal ? 'block' : 'none';
    }

    if (!isPrincipal) return;

    const sections = Database.getSections();
    const tbody = document.getElementById('settings-sections-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (sections.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 16px;">No sections created yet.</td></tr>`;
      return;
    }

    sections.forEach(secName => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding: 12px 16px; font-weight: 600; color: var(--text-primary);">${secName}</td>
        <td style="padding: 12px 16px; text-align: right;">
          <button class="btn-table-action delete" onclick="App.handleDeleteSection('${secName}')" title="Delete Section">
            <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  handleAddSection() {
    const input = document.getElementById('new-section-name');
    if (!input) return;

    const name = input.value.trim();
    if (!name) return;

    const success = Database.saveSection(name);
    if (success) {
      input.value = '';
      this.showToast(`Section "${name}" added successfully.`);
      Sounds.playSuccess();
      this.renderSectionsList();
      this.populateSectionDropdowns();
    } else {
      Sounds.playError();
      alert(`Error: Section "${name}" already exists.`);
    }
  },

  handleDeleteSection(name) {
    this.showConfirm(
      'Delete Classroom Section',
      `Are you sure you want to delete the section "${name}"? ALL students and teachers in this section will be PERMANENTLY deleted from the system, including all their attendance history. This action cannot be undone.`,
      'delete',
      'var(--status-absent)',
      () => {
        Database.deleteSection(name);
        this.showToast(`Section "${name}" deleted.`);
        Sounds.playWarning();
        this.renderSectionsList();
        this.populateSectionDropdowns();
      }
    );
  },

  openDashboardListModal(statusType) {
    const activeUser = Database.getActiveUser();
    if (!activeUser) return;
    
    const isPrincipal = activeUser.is_principal;
    const userSection = activeUser.section || '';
    const dateToday = this.currentDashboardDate || new Date().toISOString().split('T')[0];
    const sessionFilter = document.getElementById('dashboard-session-filter') ? document.getElementById('dashboard-session-filter').value : 'AM';

    const students = isPrincipal 
      ? Database.getStudents() 
      : Database.getStudents().filter(s => s.grade_section === userSection);
      
    const logs = Database.getAttendanceByDate(dateToday).filter(l => l.session === sessionFilter);

    let modalTitle = 'Attendance List';
    let filteredStudents = [];

    if (statusType === 'PRESENT') {
      modalTitle = `Present Pupils (${sessionFilter})`;
      filteredStudents = students.filter(s => {
        const log = logs.find(l => l.student_id === s.id);
        return log && log.status === 'PRESENT';
      });
    } else if (statusType === 'LATE') {
      modalTitle = `Late Arrivals (${sessionFilter})`;
      filteredStudents = students.filter(s => {
        const log = logs.find(l => l.student_id === s.id);
        return log && log.status === 'LATE';
      });
    } else if (statusType === 'ABSENT') {
      modalTitle = `Absent / Unscanned (${sessionFilter})`;
      filteredStudents = students.filter(s => {
        const log = logs.find(l => l.student_id === s.id);
        return !log || log.status === 'ABSENT';
      });
    }

    // Update Title
    const titleEl = document.getElementById('dashboard-list-modal-title');
    if (titleEl) titleEl.textContent = modalTitle;

    // Populate Table body
    const tbody = document.getElementById('dashboard-list-modal-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 32px; font-weight: 500;">No pupils found in this category.</td></tr>`;
      } else {
        filteredStudents.forEach(student => {
          const log = logs.find(l => l.student_id === student.id);
          const timeText = log && log.time_in ? log.time_in : '--:-- --';
          const statusVal = log ? log.status : 'ABSENT';
          const statusBadgeClass = statusVal === 'PRESENT' ? 'badge-present' : 'badge-absent';

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>
              <div class="student-cell">
                <img class="student-avatar" src="${student.photo_path || 'assets/photos/student_mateo.png'}">
                <div class="student-meta">
                  <span class="student-name">${student.full_name}</span>
                  <span class="student-desc">ID: ${student.student_number} ${isPrincipal ? '• ' + student.grade_section : ''}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="badge ${statusBadgeClass}">${statusVal}</span>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 4px;">${timeText}</div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }

    const modal = document.getElementById('dashboard-list-modal');
    if (modal) {
      modal.classList.add('active');
      Sounds.playSuccess();
    }
  },

  closeDashboardListModal() {
    const modal = document.getElementById('dashboard-list-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  setupHardwareListeners() {
    const handleConnect = (e) => {
      console.log('PNP Device Connected:', e.device);
      const name = e.device.productName || 'PNP Scanner';
      this.updateHardwareUI(true, name);
      this.showToast(`Scanner Connected: ${name}`);
      Sounds.playSuccess();
    };

    const handleDisconnect = (e) => {
      console.log('PNP Device Disconnected:', e.device);
      this.updateHardwareUI(false);
      this.showToast('Scanner Disconnected');
      Sounds.playWarning();
    };

    if (typeof navigator !== 'undefined') {
      if (navigator.hid) {
        navigator.hid.addEventListener('connect', handleConnect);
        navigator.hid.addEventListener('disconnect', handleDisconnect);
        
        navigator.hid.getDevices().then(devices => {
          if (devices && devices.length > 0) {
            this.updateHardwareUI(true, devices[0].productName);
          } else {
            this.updateHardwareUI(true); // fallback seed state
          }
        }).catch(() => this.updateHardwareUI(true));
      } else if (navigator.usb) {
        navigator.usb.addEventListener('connect', handleConnect);
        navigator.usb.addEventListener('disconnect', handleDisconnect);
        
        navigator.usb.getDevices().then(devices => {
          if (devices && devices.length > 0) {
            this.updateHardwareUI(true, devices[0].productName);
          } else {
            this.updateHardwareUI(true);
          }
        }).catch(() => this.updateHardwareUI(true));
      } else {
        this.updateHardwareUI(true);
      }
    }
  },

  updateHardwareUI(connected, deviceName = null) {
    const statusBadge = document.getElementById('device-status-badge');
    const nameEl = document.getElementById('device-name-text');
    
    if (statusBadge) {
      if (connected) {
        statusBadge.className = 'device-status-badge-green';
        statusBadge.textContent = 'CONNECTED';
      } else {
        statusBadge.className = 'device-status-badge-red';
        statusBadge.textContent = 'DISCONNECTED';
      }
    }

    if (nameEl && deviceName) {
      nameEl.textContent = deviceName;
    }
  },

  async handlePairHardware() {
    try {
      if (typeof navigator !== 'undefined' && navigator.hid) {
        this.showToast("Opening scanner selector...");
        const devices = await navigator.hid.requestDevice({ filters: [] });
        if (devices && devices.length > 0) {
          this.updateHardwareUI(true, devices[0].productName);
          this.showToast(`Linked: ${devices[0].productName}`);
          Sounds.playSuccess();
        }
      } else if (typeof navigator !== 'undefined' && navigator.usb) {
        this.showToast("Opening scanner selector...");
        const device = await navigator.usb.requestDevice({ filters: [] });
        if (device) {
          this.updateHardwareUI(true, device.productName);
          this.showToast(`Linked: ${device.productName}`);
          Sounds.playSuccess();
        }
      } else {
        this.showToast("PNP hardware pairing not supported in this browser.");
      }
    } catch (err) {
      console.warn("Pairing cancelled:", err);
    }
  },

  // 9. MONTHLY REPORT GENERATOR
  openMonthlyReportSelector() {
    const activeUser = Database.getActiveUser();
    if (!activeUser) return;

    this.populateReportSectionDropdown();

    const monthSelect = document.getElementById('report-month');
    const yearSelect = document.getElementById('report-year');
    const sectionSelect = document.getElementById('report-section');
    const sessionSelect = document.getElementById('report-session');

    // Preset current month and year
    const today = new Date();
    if (monthSelect) monthSelect.value = today.getMonth().toString();
    if (yearSelect) yearSelect.value = today.getFullYear().toString();

    // Select defaults based on active user
    if (!activeUser.is_principal) {
      if (sectionSelect) {
        sectionSelect.value = activeUser.section;
        sectionSelect.disabled = true;
      }
    } else {
      if (sectionSelect) {
        sectionSelect.disabled = false;
        // Select first available option if none selected
        if (sectionSelect.options.length > 0 && !sectionSelect.value) {
          sectionSelect.selectedIndex = 0;
        }
      }
    }

    const modal = document.getElementById('monthly-report-modal');
    if (modal) {
      modal.classList.add('active');
      Sounds.playSuccess();
    }
  },

  closeMonthlyReportSelector() {
    const modal = document.getElementById('monthly-report-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  populateReportSectionDropdown() {
    const sectionSelect = document.getElementById('report-section');
    if (!sectionSelect) return;

    const activeUser = Database.getActiveUser();
    const activeSections = Database.getSections();

    if (activeUser && activeUser.is_principal) {
      sectionSelect.innerHTML = activeSections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
    } else if (activeUser) {
      const section = activeUser.section || 'Grade 3 - Narra';
      sectionSelect.innerHTML = `<option value="${section}">${section}</option>`;
      sectionSelect.value = section;
    }
  },

  closeReportPreview() {
    const modal = document.getElementById('report-preview-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  printMonthlyReport() {
    window.print();
  },

  downloadExcelReport() {
    if (!App.activeReportParams) {
      App.showToast('No active report. Please generate a preview first.');
      return;
    }
    const { monthIdx, yearStr, sectionName, sessionType } = App.activeReportParams;
    App.showToast('Preparing Excel download...');
    
    try {
      fetch('./monthly%20reporting%20template.xls')
        .then(response => {
          if (!response.ok) throw new Error('Failed to load monthly reporting template.xls');
          return response.arrayBuffer();
        })
        .then(data => {
          const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellStyles: true, cellFormulas: true, cellNF: true });
          
          // Clear properties that cause errors in SheetJS BIFF8 writer
          delete workbook.Props;
          delete workbook.Custprops;
          workbook.Props = {};
          workbook.Custprops = {};
          
          const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
          const sheetName = monthNames[parseInt(monthIdx)];
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            throw new Error(`Sheet ${sheetName} not found in template.`);
          }
          
          const year = parseInt(yearStr);
          const month = parseInt(monthIdx);
          
          // Calculate School Year
          let syStr = '';
          if (month >= 5) { // June - Dec
            syStr = `${year} - ${year + 1}`;
          } else { // Jan - May
            syStr = `${year - 1} - ${year}`;
          }
          
          // Calculate Grade & Section
          let gradeLevel = "Grade 3";
          let sectionOnly = sectionName;
          if (sectionName.includes(" - ")) {
            const parts = sectionName.split(" - ");
            gradeLevel = parts[0];
            sectionOnly = parts[1];
          }
          
          // Helper functions to set cell values in-place preserving styles
          const setCellValue = (sh, r, c, val) => {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!sh[addr]) {
              sh[addr] = { t: (typeof val === 'number' ? 'n' : 's'), v: val };
            } else {
              sh[addr].v = val;
              sh[addr].t = (typeof val === 'number' ? 'n' : 's');
            }
          };
          
          const setCellAddrValue = (sh, addr, val) => {
            if (!sh[addr]) {
              sh[addr] = { t: (typeof val === 'number' ? 'n' : 's'), v: val };
            } else {
              sh[addr].v = val;
              sh[addr].t = (typeof val === 'number' ? 'n' : 's');
            }
          };

          // 1. Fill headers
          setCellAddrValue(sheet, 'M3', syStr);
          setCellAddrValue(sheet, 'AA3', sheetName);
          setCellAddrValue(sheet, 'AA4', gradeLevel);
          setCellAddrValue(sheet, 'AM4', sectionOnly.toUpperCase());
          
          // 2. Map date columns
          const dayCols = [5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 23, 25, 27, 28, 29, 30, 31, 32, 34, 35, 36];
          const dateToCol = {};
          const colToDate = {};
          
          dayCols.forEach(col => {
            const addr = XLSX.utils.encode_cell({ r: 5, c: col });
            const cell = sheet[addr];
            if (cell && cell.v !== undefined && cell.v !== '') {
              const dVal = parseInt(cell.v);
              if (!isNaN(dVal)) {
                dateToCol[dVal] = col;
                colToDate[col] = dVal;
              }
            }
          });
          
          const hasTemplateDates = Object.keys(dateToCol).length > 0;
          if (!hasTemplateDates) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let w = 0;
            const weekCols = [
              [5, 7, 8, 9, 10],
              [11, 13, 14, 15, 16],
              [17, 19, 20, 21, 23],
              [25, 27, 28, 29, 30],
              [31, 32, 34, 35, 36]
            ];
            for (let d = 1; d <= daysInMonth; d++) {
              const dateObj = new Date(year, month, d);
              const dw = dateObj.getDay();
              if (dw === 0 || dw === 6) continue;
              if (dw === 1 && d > 1) w++;
              if (w > 4) break;
              const col = weekCols[w][dw - 1];
              dateToCol[d] = col;
              colToDate[col] = d;
              setCellValue(sheet, 5, col, d);
            }
          }
          
          const settings = Database.getSettings();
          const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
          const selectedDays = (settings.classDays && settings.classDays[monthKey]) || App.getDefaultClassDays(year, month);

          // Filter to only include selected class days
          Object.keys(dateToCol).forEach(d => {
            const dayNum = parseInt(d);
            if (!selectedDays.includes(dayNum)) {
              const col = dateToCol[dayNum];
              delete dateToCol[dayNum];
              delete colToDate[col];
            }
          });
          
          // 3. Row bounds
          const isJune = (sheetName === 'JUNE');
          const maleStartRow = 7;
          const maleEndRow = isJune ? 32 : 24;
          const maleTotalRow = isJune ? 33 : 25;
          const femaleRosterStart = isJune ? 34 : 26;
          const femaleRosterEnd = isJune ? 62 : 56;
          const femaleTotalRow = isJune ? 63 : 57;
          const combinedTotalRow = isJune ? 64 : 58;
          const summaryStartRow = isJune ? 65 : 59;
          
          // 4. Load database and rosters
          const students = Database.getStudents(false).filter(s => s.grade_section === sectionName);
          const males = students.filter(s => s.gender === 'M');
          const females = students.filter(s => s.gender === 'F');
          
          males.sort((a, b) => a.full_name.localeCompare(b.full_name));
          females.sort((a, b) => a.full_name.localeCompare(b.full_name));
          
          // Clear rosters first
          for (let r = maleStartRow; r <= maleEndRow; r++) {
            setCellValue(sheet, r, 0, '');
            setCellValue(sheet, r, 2, '');
            dayCols.forEach(col => { setCellValue(sheet, r, col, ''); });
            setCellValue(sheet, r, 38, '');
            setCellValue(sheet, r, 40, '');
            setCellValue(sheet, r, 42, '');
          }
          for (let r = femaleRosterStart; r <= femaleRosterEnd; r++) {
            setCellValue(sheet, r, 0, '');
            setCellValue(sheet, r, 2, '');
            dayCols.forEach(col => { setCellValue(sheet, r, col, ''); });
            setCellValue(sheet, r, 38, '');
            setCellValue(sheet, r, 40, '');
            setCellValue(sheet, r, 42, '');
          }
          
          // Daily statistics tracking
          const dailyStats = {};
          dayCols.forEach(col => { dailyStats[col] = { malePresent: 0, femalePresent: 0 }; });
          
          // Fetch logs
          const allLogs = Database.getAttendanceAll();
          const monthlyLogs = allLogs.filter(log => {
            return log.date.startsWith(`${year}-${(month + 1).toString().padStart(2, '0')}-`);
          });
          
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Write males
          males.forEach((student, idx) => {
            const r = maleStartRow + idx;
            if (r > maleEndRow) return;
            
            setCellValue(sheet, r, 0, idx + 1);
            setCellValue(sheet, r, 2, student.full_name.toUpperCase());
            
            let absentCount = 0;
            let presentCount = 0;
            
            dayCols.forEach(col => {
              if (colToDate[col]) {
                const d = colToDate[col];
                const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                
                let mark = '';
                if (dateStr <= todayStr) {
                  const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
                  const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
                  
                  const amPresent = amLog && amLog.status !== 'ABSENT';
                  const pmPresent = pmLog && pmLog.status !== 'ABSENT';
                  
                  let dayPresentScore = 0;
                  let dayAbsentScore = 0;
                  
                  if (amPresent && pmPresent) {
                    mark = 1;
                    dayPresentScore = 1.0;
                    dayAbsentScore = 0.0;
                  } else if (amPresent || pmPresent) {
                    mark = 0.5;
                    dayPresentScore = 0.5;
                    dayAbsentScore = 0.5;
                  } else {
                    mark = 'x';
                    dayPresentScore = 0.0;
                    dayAbsentScore = 1.0;
                  }
                  
                  presentCount += dayPresentScore;
                  absentCount += dayAbsentScore;
                  dailyStats[col].malePresent += dayPresentScore;
                }
                setCellValue(sheet, r, col, mark);
              }
            });
            setCellValue(sheet, r, 38, absentCount);
            setCellValue(sheet, r, 40, presentCount);
          });
          
          // Write females
          females.forEach((student, idx) => {
            const r = femaleRosterStart + idx;
            if (r > femaleRosterEnd) return;
            
            setCellValue(sheet, r, 0, idx + 1);
            setCellValue(sheet, r, 2, student.full_name.toUpperCase());
            
            let absentCount = 0;
            let presentCount = 0;
            
            dayCols.forEach(col => {
              if (colToDate[col]) {
                const d = colToDate[col];
                const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                
                let mark = '';
                if (dateStr <= todayStr) {
                  const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
                  const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
                  
                  const amPresent = amLog && amLog.status !== 'ABSENT';
                  const pmPresent = pmLog && pmLog.status !== 'ABSENT';
                  
                  let dayPresentScore = 0;
                  let dayAbsentScore = 0;
                  
                  if (amPresent && pmPresent) {
                    mark = 1;
                    dayPresentScore = 1.0;
                    dayAbsentScore = 0.0;
                  } else if (amPresent || pmPresent) {
                    mark = 0.5;
                    dayPresentScore = 0.5;
                    dayAbsentScore = 0.5;
                  } else {
                    mark = 'x';
                    dayPresentScore = 0.0;
                    dayAbsentScore = 1.0;
                  }
                  
                  presentCount += dayPresentScore;
                  absentCount += dayAbsentScore;
                  dailyStats[col].femalePresent += dayPresentScore;
                }
                setCellValue(sheet, r, col, mark);
              }
            });
            setCellValue(sheet, r, 38, absentCount);
            setCellValue(sheet, r, 40, presentCount);
          });
          
          // 5. Daily totals & summaries
          let maleTotalAbsent = 0;
          let maleTotalPresent = 0;
          males.forEach((_, idx) => {
            maleTotalAbsent += sheet[XLSX.utils.encode_cell({ r: maleStartRow + idx, c: 38 })]?.v || 0;
            maleTotalPresent += sheet[XLSX.utils.encode_cell({ r: maleStartRow + idx, c: 40 })]?.v || 0;
          });
          
          let femaleTotalAbsent = 0;
          let femaleTotalPresent = 0;
          females.forEach((_, idx) => {
            femaleTotalAbsent += sheet[XLSX.utils.encode_cell({ r: femaleRosterStart + idx, c: 38 })]?.v || 0;
            femaleTotalPresent += sheet[XLSX.utils.encode_cell({ r: femaleRosterStart + idx, c: 40 })]?.v || 0;
          });
          
          // Write Male Daily Totals
          dayCols.forEach(col => {
            const val = colToDate[col] ? dailyStats[col].malePresent : '';
            setCellValue(sheet, maleTotalRow, col, val);
          });
          setCellValue(sheet, maleTotalRow, 38, maleTotalAbsent);
          setCellValue(sheet, maleTotalRow, 40, maleTotalPresent);
          
          // Write Female Daily Totals
          dayCols.forEach(col => {
            const val = colToDate[col] ? dailyStats[col].femalePresent : '';
            setCellValue(sheet, femaleTotalRow, col, val);
          });
          setCellValue(sheet, femaleTotalRow, 38, femaleTotalAbsent);
          setCellValue(sheet, femaleTotalRow, 40, femaleTotalPresent);
          
          // Write Combined Daily Totals
          dayCols.forEach(col => {
            const val = colToDate[col] ? (dailyStats[col].malePresent + dailyStats[col].femalePresent) : '';
            setCellValue(sheet, combinedTotalRow, col, val);
          });
          setCellValue(sheet, combinedTotalRow, 38, maleTotalAbsent + femaleTotalAbsent);
          setCellValue(sheet, combinedTotalRow, 40, maleTotalPresent + femaleTotalPresent);
          
          // 6. Write bottom statistics
          const classDays = Object.keys(dateToCol).length;
          setCellValue(sheet, summaryStartRow, 38, `Month : ${monthNames[month]}`);
          setCellValue(sheet, summaryStartRow, 41, `No. of Days of Classes: ${classDays}`);
          
          const juneShift = isJune ? 6 : 0;
          const enrolmentRow = 61 + juneShift;
          const lateEnrolmentRow = 63 + juneShift;
          const registeredRow = 67 + juneShift;
          const pctEnrolmentRow = 69 + juneShift;
          const avgAttendanceRow = 71 + juneShift;
          const pctAttendanceRow = 73 + juneShift;
          const absentStreakRow = 74 + juneShift;
          const nlsRow = 75 + juneShift;
          const transferredOutRow = 77 + juneShift;
          const transferredInRow = 79 + juneShift;
          
          // Helper to calculate Streak of 5 consecutive days absent
          const countConsecutiveAbsent = (roster) => {
            let count = 0;
            roster.forEach(student => {
              let maxConsecutive = 0;
              let currentConsecutive = 0;
              for (let col of dayCols) {
                if (colToDate[col]) {
                  const d = colToDate[col];
                  const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                  if (dateStr > todayStr) continue;
                  
                  const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
                  const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
                  const isAmAbsent = !amLog || amLog.status === 'ABSENT';
                  const isPmAbsent = !pmLog || pmLog.status === 'ABSENT';
                  const isAbsent = isAmAbsent && isPmAbsent;
                  
                  if (isAbsent) {
                    currentConsecutive++;
                    if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
                  } else {
                    currentConsecutive = 0;
                  }
                }
              }
              if (maxConsecutive >= 5) count++;
            });
            return count;
          };
          
          const maleStreak = countConsecutiveAbsent(males);
          const femaleStreak = countConsecutiveAbsent(females);
          
          // Enrolment
          setCellValue(sheet, enrolmentRow, 43, males.length);
          setCellValue(sheet, enrolmentRow, 44, females.length);
          setCellValue(sheet, enrolmentRow, 45, students.length);
          
          // Late Enrolment
          setCellValue(sheet, lateEnrolmentRow, 43, 0);
          setCellValue(sheet, lateEnrolmentRow, 44, 0);
          setCellValue(sheet, lateEnrolmentRow, 45, 0);
          
          // Registered learners
          setCellValue(sheet, registeredRow, 43, males.length);
          setCellValue(sheet, registeredRow, 44, females.length);
          setCellValue(sheet, registeredRow, 45, students.length);
          
          // Pct enrolment
          setCellValue(sheet, pctEnrolmentRow, 43, 100);
          setCellValue(sheet, pctEnrolmentRow, 44, 100);
          setCellValue(sheet, pctEnrolmentRow, 45, 100);
          
          // Average daily attendance
          const maleAvg = classDays > 0 ? (maleTotalPresent / classDays) : 0;
          const femaleAvg = classDays > 0 ? (femaleTotalPresent / classDays) : 0;
          const totalAvg = classDays > 0 ? ((maleTotalPresent + femaleTotalPresent) / classDays) : 0;
          setCellValue(sheet, avgAttendanceRow, 43, parseFloat(maleAvg.toFixed(1)));
          setCellValue(sheet, avgAttendanceRow, 44, parseFloat(femaleAvg.toFixed(1)));
          setCellValue(sheet, avgAttendanceRow, 45, parseFloat(totalAvg.toFixed(1)));
          
          // Pct attendance
          const malePct = (males.length > 0 && classDays > 0) ? (maleTotalPresent / (males.length * classDays)) : 0;
          const femalePct = (females.length > 0 && classDays > 0) ? (femaleTotalPresent / (females.length * classDays)) : 0;
          const totalPct = (students.length > 0 && classDays > 0) ? ((maleTotalPresent + femaleTotalPresent) / (students.length * classDays)) : 0;
          setCellValue(sheet, pctAttendanceRow, 43, parseFloat(malePct.toFixed(4)));
          setCellValue(sheet, pctAttendanceRow, 44, parseFloat(femalePct.toFixed(4)));
          setCellValue(sheet, pctAttendanceRow, 45, parseFloat(totalPct.toFixed(4)));
          
          // Streak 5 consecutive absent
          setCellValue(sheet, absentStreakRow, 43, maleStreak);
          setCellValue(sheet, absentStreakRow, 44, femaleStreak);
          setCellValue(sheet, absentStreakRow, 45, maleStreak + femaleStreak);
          
          // NLS, Transferred Out, Transferred In
          setCellValue(sheet, nlsRow, 43, 0);
          setCellValue(sheet, nlsRow, 44, 0);
          setCellValue(sheet, nlsRow, 45, 0);
          
          setCellValue(sheet, transferredOutRow, 43, 0);
          setCellValue(sheet, transferredOutRow, 44, 0);
          setCellValue(sheet, transferredOutRow, 45, 0);
          
          setCellValue(sheet, transferredInRow, 43, 0);
          setCellValue(sheet, transferredInRow, 44, 0);
          setCellValue(sheet, transferredInRow, 45, 0);
          
          // 7. Write Signatures
          const activeUser = Database.getActiveUser();
          const users = Database.getUsers();
          
          let advisorName = 'No Advisor Assigned';
          const sectionAdviser = users.find(u => u.section === sectionName && !u.is_principal);
          if (sectionAdviser) {
            advisorName = sectionAdviser.display_name;
          } else if (activeUser && activeUser.section === sectionName) {
            advisorName = activeUser.display_name;
          }
          
          const principalUser = users.find(u => u.is_principal);
          const principalName = principalUser ? principalUser.display_name : 'Dr. Albert Flores';
          
          setCellValue(sheet, 84 + juneShift, 39, advisorName.toUpperCase());
          setCellValue(sheet, 90 + juneShift, 39, principalName.toUpperCase());
          
          // Save workbook
          const fileName = `SF2_${sectionName.replace(/\s+/g, '_')}_${sheetName}_${year}.xls`;
          XLSX.writeFile(workbook, fileName, { bookType: 'biff8' });
          App.showToast(`Report downloaded: ${fileName}`);
        })
        .catch(err => {
          console.error(err);
          if (window.location.protocol === 'file:') {
            Sounds.playError();
            alert("Security Error (CORS): Browsers block loading template files under 'file://' protocol. You must run the application through a web server. Please open the app via the local development server at http://localhost:8080");
            App.showToast("CORS Blocked: Please use http://localhost:8080");
          } else {
            App.showToast(`Failed to download Excel report: ${err.message || err}`);
          }
        });
    } catch (e) {
      console.error(e);
      App.showToast(`Failed to download Excel report: ${e.message || e}`);
    }
  },

  generateMonthlyReport(monthIdx, yearStr, sectionName, sessionType) {
    const year = parseInt(yearStr);
    const month = parseInt(monthIdx);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[month].toUpperCase();
    
    App.activeReportParams = { monthIdx, yearStr, sectionName, sessionType };
    App.showToast('Preparing preview...');

    fetch('./monthly%20reporting%20template.xls')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load monthly reporting template.xls');
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        
        const sheetName = monthNames[month].toUpperCase();
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error(`Sheet ${sheetName} not found in template.`);
        
        // Determine school year
        let syStr = '';
        if (month >= 5) {
          syStr = `${year} - ${year + 1}`;
        } else {
          syStr = `${year - 1} - ${year}`;
        }
        
        // Determine Grade & Section
        let gradeLevel = "Grade 3";
        let sectionOnly = sectionName;
        if (sectionName.includes(" - ")) {
          const parts = sectionName.split(" - ");
          gradeLevel = parts[0];
          sectionOnly = parts[1];
        }
        
        // Map dates
        const dayCols = [5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 23, 25, 27, 28, 29, 30, 31, 32, 34, 35, 36];
        const dateToCol = {};
        const colToDate = {};
        
        dayCols.forEach(col => {
          const addr = XLSX.utils.encode_cell({ r: 5, c: col });
          const cell = sheet[addr];
          if (cell && cell.v !== undefined && cell.v !== '') {
            const dVal = parseInt(cell.v);
            if (!isNaN(dVal)) {
              dateToCol[dVal] = col;
              colToDate[col] = dVal;
            }
          }
        });
        
        const hasTemplateDates = Object.keys(dateToCol).length > 0;
        if (!hasTemplateDates) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          let w = 0;
          const weekCols = [
            [5, 7, 8, 9, 10],
            [11, 13, 14, 15, 16],
            [17, 19, 20, 21, 23],
            [25, 27, 28, 29, 30],
            [31, 32, 34, 35, 36]
          ];
          for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dw = dateObj.getDay();
            if (dw === 0 || dw === 6) continue;
            if (dw === 1 && d > 1) w++;
            if (w > 4) break;
            const col = weekCols[w][dw - 1];
            dateToCol[d] = col;
            colToDate[col] = d;
          }
        }
        
        const settings = Database.getSettings();
        const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
        const selectedDays = (settings.classDays && settings.classDays[monthKey]) || App.getDefaultClassDays(year, month);

        // Filter to only include selected class days
        Object.keys(dateToCol).forEach(d => {
          const dayNum = parseInt(d);
          if (!selectedDays.includes(dayNum)) {
            const col = dateToCol[dayNum];
            delete dateToCol[dayNum];
            delete colToDate[col];
          }
        });
        
        // List of active columns and their date values
        const activeDays = dayCols.filter(col => colToDate[col] !== undefined).map(col => ({
          col: col,
          dayNum: colToDate[col],
          dayOfWeek: ["M", "T", "W", "TH", "F"][dayCols.indexOf(col) % 5]
        }));
        
        // Load rosters
        const students = Database.getStudents(false).filter(s => s.grade_section === sectionName);
        const males = students.filter(s => s.gender === 'M');
        const females = students.filter(s => s.gender === 'F');
        
        males.sort((a, b) => a.full_name.localeCompare(b.full_name));
        females.sort((a, b) => a.full_name.localeCompare(b.full_name));
        
        // Load attendance logs
        const allLogs = Database.getAttendanceAll();
        const monthlyLogs = allLogs.filter(log => {
          return log.date.startsWith(`${year}-${(month + 1).toString().padStart(2, '0')}-`);
        });
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Helper to compute student attendance row HTML
        const renderStudentRowHtml = (student, index) => {
          let rowHtml = `<tr><td>${index + 1}</td><td class="student-name-col">${student.full_name.toUpperCase()}</td>`;
          let absentCount = 0;
          let presentCount = 0;
          
          activeDays.forEach(day => {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.dayNum.toString().padStart(2, '0')}`;
            
            let mark = '';
            let cellClass = '';
            if (dateStr <= todayStr) {
              const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
              const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
              
              const amPresent = amLog && amLog.status !== 'ABSENT';
              const pmPresent = pmLog && pmLog.status !== 'ABSENT';
              
              let dayPresentScore = 0;
              let dayAbsentScore = 0;
              
              if (amPresent && pmPresent) {
                mark = '1';
                cellClass = 'status-mark-present';
                dayPresentScore = 1.0;
                dayAbsentScore = 0.0;
              } else if (amPresent || pmPresent) {
                mark = '0.5';
                cellClass = 'status-mark-late';
                dayPresentScore = 0.5;
                dayAbsentScore = 0.5;
              } else {
                mark = 'x';
                cellClass = 'status-mark-absent';
                dayPresentScore = 0.0;
                dayAbsentScore = 1.0;
              }
              
              presentCount += dayPresentScore;
              absentCount += dayAbsentScore;
            }
            rowHtml += `<td class="${cellClass}">${mark}</td>`;
          });
          
          rowHtml += `<td>${absentCount}</td><td>${presentCount}</td><td></td></tr>`;
          return { html: rowHtml, absent: absentCount, present: presentCount };
        };
        
        // Generate daily totals
        const dailyPresentCounts = {};
        activeDays.forEach(day => {
          dailyPresentCounts[day.col] = { male: 0, female: 0 };
        });
        
        // Calculate and render males
        let malesHtml = '';
        let maleTotalAbsent = 0;
        let maleTotalPresent = 0;
        
        males.forEach((student, idx) => {
          const result = renderStudentRowHtml(student, idx);
          malesHtml += result.html;
          maleTotalAbsent += result.absent;
          maleTotalPresent += result.present;
          
          // Count daily present/late
          activeDays.forEach(day => {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.dayNum.toString().padStart(2, '0')}`;
            if (dateStr <= todayStr) {
              const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
              const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
              
              const amPresent = amLog && amLog.status !== 'ABSENT';
              const pmPresent = pmLog && pmLog.status !== 'ABSENT';
              
              let dayPresentScore = 0;
              if (amPresent && pmPresent) dayPresentScore = 1.0;
              else if (amPresent || pmPresent) dayPresentScore = 0.5;
              
              dailyPresentCounts[day.col].male += dayPresentScore;
            }
          });
        });
        
        // Calculate and render females
        let femalesHtml = '';
        let femaleTotalAbsent = 0;
        let femaleTotalPresent = 0;
        
        females.forEach((student, idx) => {
          const result = renderStudentRowHtml(student, idx);
          femalesHtml += result.html;
          femaleTotalAbsent += result.absent;
          femaleTotalPresent += result.present;
          
          // Count daily present/late
          activeDays.forEach(day => {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.dayNum.toString().padStart(2, '0')}`;
            if (dateStr <= todayStr) {
              const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
              const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
              
              const amPresent = amLog && amLog.status !== 'ABSENT';
              const pmPresent = pmLog && pmLog.status !== 'ABSENT';
              
              let dayPresentScore = 0;
              if (amPresent && pmPresent) dayPresentScore = 1.0;
              else if (amPresent || pmPresent) dayPresentScore = 0.5;
              
              dailyPresentCounts[day.col].female += dayPresentScore;
            }
          });
        });
        
        // Render Male Total Row
        let maleTotalRowHtml = `<tr style="background-color: #f1f5f9; font-weight: 700;"><td></td><td>MALE TOTAL Per Day</td>`;
        activeDays.forEach(day => {
          maleTotalRowHtml += `<td>${dailyPresentCounts[day.col].male}</td>`;
        });
        maleTotalRowHtml += `<td>${maleTotalAbsent}</td><td>${maleTotalPresent}</td><td></td></tr>`;
        
        // Render Female Total Row
        let femaleTotalRowHtml = `<tr style="background-color: #f1f5f9; font-weight: 700;"><td></td><td>FEMALE TOTAL Per Day</td>`;
        activeDays.forEach(day => {
          femaleTotalRowHtml += `<td>${dailyPresentCounts[day.col].female}</td>`;
        });
        femaleTotalRowHtml += `<td>${femaleTotalAbsent}</td><td>${femaleTotalPresent}</td><td></td></tr>`;
        
        // Render Combined Total Row
        let combinedTotalRowHtml = `<tr style="background-color: #e2e8f0; font-weight: 800;"><td></td><td>Combined TOTAL Per Day</td>`;
        activeDays.forEach(day => {
          combinedTotalRowHtml += `<td>${dailyPresentCounts[day.col].male + dailyPresentCounts[day.col].female}</td>`;
        });
        combinedTotalRowHtml += `<td>${maleTotalAbsent + femaleTotalAbsent}</td><td>${maleTotalPresent + femaleTotalPresent}</td><td></td></tr>`;
        
        // Table Headers
        let tableHeaderHtml = `
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px;">No.</th>
              <th rowspan="2" style="width: 220px; text-align: left;">NAME (Last Name, First Name, Middle Name)</th>
              <th colspan="${activeDays.length}">Mondays to Fridays (Calendar Days)</th>
              <th colspan="2">Total for the Month</th>
              <th rowspan="2" style="width: 150px;">REMARKS</th>
            </tr>
            <tr>
        `;
        
        activeDays.forEach(day => {
          tableHeaderHtml += `<th style="width: 22px;" title="${day.dayOfWeek}">${day.dayNum}</th>`;
        });
        
        tableHeaderHtml += `
              <th style="width: 32px;">ABSENT</th>
              <th style="width: 32px;">PRESENT</th>
            </tr>
          </thead>
        `;
        
        // HTML construction
        const printArea = document.getElementById('print-paper-sheet');
        if (!printArea) return;
        
        // Calculate Stats
        const classDays = activeDays.length;
        const maleAvg = classDays > 0 ? (maleTotalPresent / classDays) : 0;
        const femaleAvg = classDays > 0 ? (femaleTotalPresent / classDays) : 0;
        const totalAvg = classDays > 0 ? ((maleTotalPresent + femaleTotalPresent) / classDays) : 0;
        
        const malePct = (males.length > 0 && classDays > 0) ? (maleTotalPresent / (males.length * classDays)) : 0;
        const femalePct = (females.length > 0 && classDays > 0) ? (femaleTotalPresent / (females.length * classDays)) : 0;
        const totalPct = (students.length > 0 && classDays > 0) ? ((maleTotalPresent + femaleTotalPresent) / (students.length * classDays)) : 0;
        
        const countStreak = (roster) => {
          let count = 0;
          roster.forEach(student => {
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            activeDays.forEach(day => {
              const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.dayNum.toString().padStart(2, '0')}`;
              if (dateStr > todayStr) return;
              
              const amLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'AM');
              const pmLog = monthlyLogs.find(l => l.student_id === student.id && l.date === dateStr && l.session === 'PM');
              const isAmAbsent = !amLog || amLog.status === 'ABSENT';
              const isPmAbsent = !pmLog || pmLog.status === 'ABSENT';
              const isAbsent = isAmAbsent && isPmAbsent;
              
              if (isAbsent) {
                currentConsecutive++;
                if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
              } else {
                currentConsecutive = 0;
              }
            });
            if (maxConsecutive >= 5) count++;
          });
          return count;
        };
        
        const maleStreak = countStreak(males);
        const femaleStreak = countStreak(females);
        
        // Retrieve names
        const activeUser = Database.getActiveUser();
        const users = Database.getUsers();
        
        let advisorName = 'No Advisor Assigned';
        const sectionAdviser = users.find(u => u.section === sectionName && !u.is_principal);
        if (sectionAdviser) {
          advisorName = sectionAdviser.display_name;
        } else if (activeUser && activeUser.section === sectionName) {
          advisorName = activeUser.display_name;
        }
        
        const principalUser = users.find(u => u.is_principal);
        const principalName = principalUser ? principalUser.display_name : 'Dr. Albert Flores';
        
        // Formulate layout
        printArea.innerHTML = `
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0;">School Form 2 (SF2) Daily Attendance Report of Learners</h2>
            <p style="font-size: 10px; color: #475569; margin: 2px 0 0 0;">(This replaces Form 1, Form 2 & STS Form 4 - Absenteeism and Dropout Profile)</p>
          </div>
          
          <table style="width: 100%; font-size: 11px; margin-bottom: 15px; border-collapse: collapse;">
            <tr>
              <td style="border: none; padding: 2px 0; text-align: left; width: 16%;">School ID: <strong>120208</strong></td>
              <td style="border: none; padding: 2px 0; text-align: left; width: 25%;">School Year: <strong>${syStr}</strong></td>
              <td style="border: none; padding: 2px 0; text-align: left;">Report for the Month of: <strong>${monthName}</strong></td>
            </tr>
            <tr>
              <td style="border: none; padding: 2px 0; text-align: left;">School Name: <strong>Malaiba ES</strong></td>
              <td style="border: none; padding: 2px 0; text-align: left;">Grade Level: <strong>${gradeLevel}</strong></td>
              <td style="border: none; padding: 2px 0; text-align: left;">Section: <strong>${sectionOnly.toUpperCase()}</strong></td>
            </tr>
          </table>
          
          <table class="report-grid-table">
            ${tableHeaderHtml}
            <tbody>
              <tr class="gender-header-row"><td colspan="${activeDays.length + 5}">MALE</td></tr>
              ${malesHtml || '<tr><td colspan="' + (activeDays.length + 5) + '" style="text-align: center; color: #64748b;">No male students</td></tr>'}
              ${maleTotalRowHtml}
              
              <tr class="gender-header-row"><td colspan="${activeDays.length + 5}">FEMALE</td></tr>
              ${femalesHtml || '<tr><td colspan="' + (activeDays.length + 5) + '" style="text-align: center; color: #64748b;">No female students</td></tr>'}
              ${femaleTotalRowHtml}
              
              ${combinedTotalRowHtml}
            </tbody>
          </table>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 11px; margin-top: 20px;">
            <!-- Left side: Summary Block -->
            <div>
              <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px;">Summary Statistics</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                  <tr style="background-color: #f8fafc; font-weight: 700;">
                    <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: left;">Metric</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px; width: 40px;">M</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px; width: 40px;">F</th>
                    <th style="border: 1px solid #cbd5e1; padding: 4px; width: 50px;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">1. Enrolment as of (1st Friday of the SY)</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${males.length}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${females.length}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">${students.length}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">2. Late enrolment during the month</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">0</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">0</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">0</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">3. Registered Learners as of end of month</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${males.length}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${females.length}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">${students.length}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">4. Percentage of Enrolment end of month</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">100%</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">100%</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">100%</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">5. Average Daily Attendance</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${maleAvg.toFixed(1)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${femaleAvg.toFixed(1)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">${totalAvg.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">6. Percentage of Attendance for the month</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(malePct * 100).toFixed(1)}%</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(femalePct * 100).toFixed(1)}%</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">${(totalPct * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 4px;">7. Students absent for 5 consecutive days</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${maleStreak}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${femaleStreak}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: 700;">${maleStreak + femaleStreak}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Right side: Signatures -->
            <div style="display: flex; flex-direction: column; justify-content: space-between;">
              <div style="margin-bottom: 20px;">
                <p style="margin: 0; font-size: 10px; font-weight: 600;">I certify that this is a true and correct report.</p>
                <div style="margin-top: 30px; text-align: center;">
                  <strong style="border-bottom: 1.5px solid #000; display: inline-block; width: 80%; padding-bottom: 2px;">${advisorName.toUpperCase()}</strong>
                  <div style="font-size: 9px; color: #475569; margin-top: 3px; font-weight: 600;">(Signature of Adviser over Printed Name)</div>
                </div>
              </div>
              <div>
                <p style="margin: 0; font-size: 10px; font-weight: 600;">Attested by:</p>
                <div style="margin-top: 30px; text-align: center;">
                  <strong style="border-bottom: 1.5px solid #000; display: inline-block; width: 80%; padding-bottom: 2px;">${principalName.toUpperCase()}</strong>
                  <div style="font-size: 9px; color: #475569; margin-top: 3px; font-weight: 600;">(Signature of School Head over Printed Name)</div>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Close selector and open preview modal
        this.closeMonthlyReportSelector();
        
        const previewModal = document.getElementById('report-preview-modal');
        if (previewModal) {
          previewModal.classList.add('active');
          Sounds.playSuccess();
        }
      })
      .catch(err => {
        console.error(err);
        if (window.location.protocol === 'file:') {
          Sounds.playError();
          alert("Security Error (CORS): Browsers block loading template files under 'file://' protocol. You must run the application through a web server. Please open the app via the local development server at http://localhost:8080");
          App.showToast("CORS Blocked: Please use http://localhost:8080");
        } else {
          App.showToast(`Error preparing report: ${err.message || err}`);
        }
      });
  }
};

// Expose Application globally
window.App = App;

// Auto startup once page loads
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
