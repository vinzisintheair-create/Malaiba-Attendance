// Malaiba ES Attendance System - Local Database Persistence Layer (database.js)

const DB_KEYS = {
  STUDENTS: 'malaiba_students',
  ATTENDANCE: 'malaiba_attendance',
  SETTINGS: 'malaiba_settings',
  USERS: 'malaiba_users',
  ACTIVE_USER: 'malaiba_active_user',
  FIREBASE_CONFIG: 'malaiba_firebase_config',
  SECTIONS: 'malaiba_sections'
};

// Initial Seed Data
const DEFAULT_STUDENTS = [
  {
    id: '2024-0001',
    student_number: '2024-0001',
    full_name: 'Elena Rodriguez',
    grade_section: 'Grade 3 - Narra',
    gender: 'F',
    rfid_uid: 'E2801108C5',
    guardian_name: 'Maria Rodriguez',
    contact_number: '+63 917 123 4567',
    relationship: 'Mother',
    photo_path: 'assets/photos/student_elena.png'
  },
  {
    id: '2024-0002',
    student_number: '2024-0002',
    full_name: 'Mateo Santos',
    grade_section: 'Grade 3 - Narra',
    gender: 'M',
    rfid_uid: '', // Pending registration
    guardian_name: 'Juan Santos',
    contact_number: '+63 918 234 5678',
    relationship: 'Father',
    photo_path: 'assets/photos/student_mateo.png'
  },
  {
    id: '2024-0003',
    student_number: '2024-0003',
    full_name: 'Sofia Gomez',
    grade_section: 'Grade 3 - Molave',
    gender: 'F',
    rfid_uid: 'A4F92210D2',
    guardian_name: 'Lucia Gomez',
    contact_number: '+63 919 345 6789',
    relationship: 'Mother',
    photo_path: 'assets/photos/student_sofia.png'
  },
  {
    id: '2024-0004',
    student_number: '2024-0004',
    full_name: 'Julian Cruz',
    grade_section: 'Grade 3 - Narra',
    gender: 'M',
    rfid_uid: 'B7C34491F8',
    guardian_name: 'Pedro Cruz',
    contact_number: '+63 920 456 7890',
    relationship: 'Father',
    photo_path: 'assets/photos/student_julian.png'
  }
];

// Generate dynamic students to reach a ledger size of 32 (matching mockups)
const FIRST_NAMES = ['Angelo', 'Sofia', 'Marcus', 'Lucas', 'Gabriel', 'Maria', 'Jose', 'Juan', 'Patricia', 'Chloe', 'Daniel', 'Ethan', 'David', 'Bianca', 'Samantha', 'Nathan', 'Miguel', 'Princess', 'Lester', 'Kimberly', 'Joshua', 'Alyssa', 'Justin', 'Faith', 'Paolo', 'Nicole', 'Adrian', 'Angel'];
const LAST_NAMES = ['Cruz', 'Reyes', 'Rivera', 'Santos', 'Aquino', 'Del Rosario', 'Garcia', 'Gonzales', 'Flores', 'Villanueva', 'Santiago', 'Ramos', 'Castro', 'Bautista', 'Pascual', 'Dela Cruz', 'Mendoza', 'Torres', 'Lim', 'Tan', 'Valenzuela', 'Mercado', 'De Leon', 'Dizon', 'Soriano', 'Guzman', 'Tolentino', 'Santos'];
const SECTIONS = ['Grade 3 - Narra', 'Grade 3 - Molave', 'Grade 3 - Mahogany'];

function generateSeedStudents() {
  const students = [...DEFAULT_STUDENTS];
  let idCounter = 5;
  
  while (students.length < 32) {
    const fn = FIRST_NAMES[(idCounter * 7) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(idCounter * 11) % LAST_NAMES.length];
    const fullName = `${fn} ${ln}`;
    const id = `2024-00${idCounter < 10 ? '0' + idCounter : idCounter}`;
    
    // Generate unique RFID UIDs for most of them (4 will remain unlinked to match mockup: 28 active RFID, 4 pending)
    let rfid = '';
    if (students.length < 29) {
      rfid = (Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 4)).toUpperCase();
    }
    
    const isFemale = ['Sofia', 'Maria', 'Patricia', 'Chloe', 'Bianca', 'Samantha', 'Princess', 'Kimberly', 'Alyssa', 'Faith', 'Nicole', 'Angel'].includes(fn);
    const gender = isFemale ? 'F' : 'M';
    
    students.push({
      id: id,
      student_number: id,
      full_name: fullName,
      grade_section: SECTIONS[(idCounter * 3) % SECTIONS.length],
      gender: gender,
      rfid_uid: rfid,
      guardian_name: `Guardian of ${fn}`,
      contact_number: `+63 917 ${Math.floor(1000000 + Math.random() * 9000000)}`,
      relationship: Math.random() > 0.5 ? 'Mother' : 'Father',
      photo_path: 'assets/photos/student_mateo.png' // fallback avatar
    });
    idCounter++;
  }
  return students;
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBzgJ-865n2e000oy6fs5NiqORl9GPAhQk",
  authDomain: "malaiba-attendance.firebaseapp.com",
  projectId: "malaiba-attendance",
  storageBucket: "malaiba-attendance.firebasestorage.app",
  messagingSenderId: "445788586741",
  appId: "1:445788586741:web:73c6f6e514e90f4d837bbc",
  measurementId: "G-KR42E1GDRN"
};

const DEFAULT_SETTINGS = {
  lateThresholdMinutes: 15,
  defaultStartTime: '07:30',
  defaultLateTime: '07:45',
  serverSyncUrl: 'https://api.malaiba-es.edu.ph/v1/attendance/sync',
  mockServerMode: true,
  amStartTime: '07:30',
  amLateMin: '07:45',
  amLateMax: '08:30',
  amDeadline: '09:30',
  pmStartTime: '13:00',
  pmLateMin: '13:15',
  pmLateMax: '14:00',
  pmDeadline: '15:00'
};

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'password', // in a real app, hash it
    display_name: 'Admin',
    role: 'Grade 3 Adviser',
    section: 'Grade 3 - Narra',
    photo_path: 'assets/photos/teacher_santos.png',
    needs_password_reset: false,
    is_principal: false
  },
  {
    username: 'principal',
    password: 'password',
    display_name: 'Dr. Albert Flores',
    role: 'School Principal',
    section: '',
    photo_path: 'assets/photos/teacher_santos.png',
    needs_password_reset: false,
    is_principal: true
  }
];

// Helper to pre-populate yesterday's attendance history
function generateSeedAttendance(students) {
  const history = [];
  const dates = [];
  
  // Create last 3 days of historical logs
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Format YYYY-MM-DD
    const dateStr = d.toISOString().split('T')[0];
    dates.push(dateStr);
  }
  
  dates.forEach(dateStr => {
    students.forEach(student => {
      // Morning (AM)
      const randAM = Math.random();
      if (randAM < 0.90) {
        let timeIn = '07:';
        let status = 'PRESENT';
        timeIn += Math.floor(15 + Math.random() * 30);
        timeIn += ' AM';
        history.push({
          id: `${dateStr}_AM_${student.id}`,
          student_id: student.id,
          date: dateStr,
          session: 'AM',
          time_in: timeIn,
          status: status,
          method: Math.random() > 0.15 ? 'RFID Scan' : 'Manual Entry',
          synced: true
        });
      } else {
        history.push({
          id: `${dateStr}_AM_${student.id}`,
          student_id: student.id,
          date: dateStr,
          session: 'AM',
          time_in: '--:-- --',
          status: 'ABSENT',
          method: 'No Entry',
          synced: true
        });
      }

      // Afternoon (PM)
      const randPM = Math.random();
      if (randPM < 0.92) {
        let timeIn = '01:';
        let status = 'PRESENT';
        timeIn += Math.floor(0 + Math.random() * 15);
        timeIn += ' PM';
        history.push({
          id: `${dateStr}_PM_${student.id}`,
          student_id: student.id,
          date: dateStr,
          session: 'PM',
          time_in: timeIn,
          status: status,
          method: Math.random() > 0.15 ? 'RFID Scan' : 'Manual Entry',
          synced: true
        });
      } else {
        history.push({
          id: `${dateStr}_PM_${student.id}`,
          student_id: student.id,
          date: dateStr,
          session: 'PM',
          time_in: '--:-- --',
          status: 'ABSENT',
          method: 'No Entry',
          synced: true
        });
      }
    });
  });
  
  return history;
}

// Database Initializer
const Database = {
  fbApp: null,
  fbDb: null,
  fbPersistenceEnabled: false,
  fbListeners: [],
  lastFbConfigJson: null,

  disconnectFirebase() {
    this.unsubscribeListeners();
    this.fbDb = null;
    this.lastFbConfigJson = null;
    if (this.fbApp) {
      try {
        this.fbApp.delete();
      } catch (e) {
        console.warn("Error deleting Firebase app:", e);
      }
      this.fbApp = null;
    }
  },

  unsubscribeListeners() {
    if (this.fbListeners && this.fbListeners.length > 0) {
      console.log(`Unsubscribing from ${this.fbListeners.length} active Firestore listeners.`);
      this.fbListeners.forEach(unsub => {
        if (typeof unsub === 'function') {
          try {
            unsub();
          } catch (e) {
            console.warn("Error unsubscribing listener:", e);
          }
        }
      });
      this.fbListeners = [];
    }
  },


  init() {
    if (!localStorage.getItem(DB_KEYS.STUDENTS)) {
      const seededStudents = generateSeedStudents();
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(seededStudents));
      localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(generateSeedAttendance(seededStudents)));
    } else {
      try {
        const storedStudents = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS));
        if (Array.isArray(storedStudents)) {
          let updated = false;
          storedStudents.forEach(s => {
            if (!s.gender) {
              const nameLower = s.full_name.toLowerCase();
              const isFemale = nameLower.includes('anne') || nameLower.includes('grace') || nameLower.includes('nicole') || nameLower.includes('allysa') || nameLower.includes('elena') || nameLower.includes('sofia') || nameLower.includes('maria') || nameLower.includes('patricia') || nameLower.includes('samantha') || nameLower.includes('antoniette') || nameLower.includes('diorec');
              s.gender = isFemale ? 'F' : 'M';
              updated = true;
            }
          });
          if (updated) {
            localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(storedStudents));
          }
        }
      } catch (e) {
        console.warn("Local students migration failed:", e);
      }
    }
    if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
      localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(DB_KEYS.SECTIONS)) {
      localStorage.setItem(DB_KEYS.SECTIONS, JSON.stringify(['Grade 3 - Narra', 'Grade 3 - Molave', 'Grade 3 - Mahogany']));
    }
    
    // Ensure all default users (admin, principal) exist in the local database
    const storedUsersStr = localStorage.getItem(DB_KEYS.USERS);
    if (!storedUsersStr) {
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    } else {
      try {
        const parsedUsers = JSON.parse(storedUsersStr);
        let updated = false;
        DEFAULT_USERS.forEach(defaultUser => {
          const existing = parsedUsers.find(u => u.username === defaultUser.username);
          if (!existing) {
            parsedUsers.push(defaultUser);
            updated = true;
          } else if (defaultUser.username === 'admin' && existing.display_name === 'Mrs. Elena Santos') {
            existing.display_name = 'Admin';
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(DB_KEYS.USERS, JSON.stringify(parsedUsers));
        }
      } catch (e) {
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      }
    }
    
    // Migrate active user if currently Elena Santos
    const activeUserStr = localStorage.getItem(DB_KEYS.ACTIVE_USER);
    if (activeUserStr) {
      try {
        const activeUser = JSON.parse(activeUserStr);
        if (activeUser.username === 'admin' && activeUser.display_name === 'Mrs. Elena Santos') {
          activeUser.display_name = 'Admin';
          localStorage.setItem(DB_KEYS.ACTIVE_USER, JSON.stringify(activeUser));
        }
      } catch (e) {
        console.warn("Active user migration failed:", e);
      }
    }
    
    // Initialize Firebase if config exists
    this.initFirebase();
  },

  async initFirebase() {
    let configStr = localStorage.getItem(DB_KEYS.FIREBASE_CONFIG);
    if (!configStr) {
      // Auto-seed the default configuration so it connects automatically
      localStorage.setItem(DB_KEYS.FIREBASE_CONFIG, JSON.stringify(DEFAULT_FIREBASE_CONFIG));
      configStr = JSON.stringify(DEFAULT_FIREBASE_CONFIG);
    }

    try {
      const config = JSON.parse(configStr);
      const configJson = JSON.stringify(config);
      
      // If already initialized with the exact same config, return early
      if (this.fbDb && this.lastFbConfigJson === configJson) {
        return;
      }

      // Unsubscribe from any active listeners first
      this.unsubscribeListeners();

      if (typeof firebase !== 'undefined') {
        // Delete existing default app if it already exists
        if (firebase.apps.length > 0) {
          try {
            await firebase.app().delete();
          } catch (e) {
            console.warn("Failed to delete existing Firebase app:", e);
          }
        }

        this.fbApp = firebase.initializeApp(config);
        this.fbDb = firebase.firestore();
        this.lastFbConfigJson = configJson;
        
        // Enable offline persistence only once
        if (!this.fbPersistenceEnabled) {
          try {
            await this.fbDb.enablePersistence({ synchronizeTabs: true });
            this.fbPersistenceEnabled = true;
          } catch (err) {
            if (err.code === 'failed-precondition') {
              console.warn("Firebase persistence failed-precondition: Multiple tabs open.");
            } else if (err.code === 'unimplemented') {
              console.warn("Firebase persistence unimplemented in this browser.");
            }
          }
        }

        console.log("Firebase Firestore initialized successfully with offline persistence.");
        
        await this.uploadLocalDataToFirestore();
        this.setupRealtimeListeners();
      } else {
        console.warn("Firebase SDK is not loaded.");
      }
    } catch (err) {
      console.error("Failed to initialize Firebase:", err);
    }
  },

  async uploadLocalDataToFirestore() {
    if (!this.fbDb) return;
    
    try {
      const studentsSnapshot = await this.fbDb.collection('students').limit(1).get();
      if (studentsSnapshot.empty) {
        console.log("Firestore students collection is empty. Uploading local seed data...");
        const students = this.getStudents();
        const batch = this.fbDb.batch();
        students.forEach(student => {
          const docRef = this.fbDb.collection('students').doc(student.id);
          batch.set(docRef, student);
        });
        await batch.commit();
        console.log("Uploaded local students to Firestore.");
      }
      
      const attendanceSnapshot = await this.fbDb.collection('attendance').limit(1).get();
      if (attendanceSnapshot.empty) {
        console.log("Firestore attendance collection is empty. Uploading local seed logs...");
        const attendance = this.getAttendanceAll();
        const batch = this.fbDb.batch();
        attendance.forEach(record => {
          const docRef = this.fbDb.collection('attendance').doc(record.id);
          batch.set(docRef, record);
        });
        await batch.commit();
        console.log("Uploaded local attendance logs to Firestore.");
      }

      const usersSnapshot = await this.fbDb.collection('users').limit(1).get();
      if (usersSnapshot.empty) {
        console.log("Firestore users collection is empty. Uploading local seed users...");
        const users = this.getUsers();
        const batch = this.fbDb.batch();
        users.forEach(user => {
          const docRef = this.fbDb.collection('users').doc(user.username);
          batch.set(docRef, user);
        });
        await batch.commit();
        console.log("Uploaded local users to Firestore.");
      } else {
        // Ensure cloud admin name is migrated
        try {
          const adminDoc = await this.fbDb.collection('users').doc('admin').get();
          if (adminDoc.exists && adminDoc.data().display_name === 'Mrs. Elena Santos') {
            await this.fbDb.collection('users').doc('admin').update({ display_name: 'Admin' });
            console.log("Migrated Firestore admin name to 'Admin'.");
          }
        } catch (err) {
          console.warn("Failed to migrate Firestore admin name:", err);
        }
      }

      const sectionsSnapshot = await this.fbDb.collection('sections').limit(1).get();
      if (sectionsSnapshot.empty) {
        console.log("Firestore sections collection is empty. Uploading local seed sections...");
        const sections = this.getSections();
        const batch = this.fbDb.batch();
        sections.forEach(secName => {
          const docRef = this.fbDb.collection('sections').doc(secName);
          batch.set(docRef, { name: secName });
        });
        await batch.commit();
        console.log("Uploaded local sections to Firestore.");
      }
    } catch (err) {
      console.warn("Failed to upload seed data to Firestore:", err);
    }
  },

  setupRealtimeListeners() {
    if (!this.fbDb) return;
    
    // Clean up any existing listeners first
    this.unsubscribeListeners();

    console.log("Setting up Firestore realtime listeners...");
    
    // Listen for Students
    const unsubStudents = this.fbDb.collection('students').onSnapshot(snapshot => {
      const students = [];
      snapshot.forEach(doc => {
        students.push(doc.data());
      });
      if (students.length > 0) {
        students.forEach(s => {
          if (!s.gender) {
            const nameLower = s.full_name.toLowerCase();
            const isFemale = nameLower.includes('anne') || nameLower.includes('grace') || nameLower.includes('nicole') || nameLower.includes('allysa') || nameLower.includes('elena') || nameLower.includes('sofia') || nameLower.includes('maria') || nameLower.includes('patricia') || nameLower.includes('samantha') || nameLower.includes('antoniette') || nameLower.includes('diorec');
            s.gender = isFemale ? 'F' : 'M';
            this.fbDb.collection('students').doc(s.id).set({ gender: s.gender }, { merge: true })
              .catch(err => console.warn("Firestore sync gender migration failed:", err));
          }
        });
        localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
        if (window.App && typeof window.App.renderScreen === 'function') {
          window.App.renderScreen(window.App.currentScreen);
        }
      }
    }, err => console.warn("Students listener failed:", err));
    this.fbListeners.push(unsubStudents);

    // Listen for Attendance
    const unsubAttendance = this.fbDb.collection('attendance').onSnapshot(snapshot => {
      const attendance = [];
      snapshot.forEach(doc => {
        attendance.push(doc.data());
      });
      if (attendance.length > 0) {
        localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));
        if (window.App && typeof window.App.renderScreen === 'function') {
          window.App.renderScreen(window.App.currentScreen);
        }
      }
    }, err => console.warn("Attendance listener failed:", err));
    this.fbListeners.push(unsubAttendance);

    // Listen for Users
    const unsubUsers = this.fbDb.collection('users').onSnapshot(snapshot => {
      const users = [];
      snapshot.forEach(doc => {
        users.push(doc.data());
      });
      if (users.length > 0) {
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
        const activeUser = this.getActiveUser();
        if (activeUser) {
          const updated = users.find(u => u.username === activeUser.username);
          if (updated) {
            localStorage.setItem(DB_KEYS.ACTIVE_USER, JSON.stringify(updated));
            if (window.App && typeof window.App.updateProfileUI === 'function') {
              window.App.updateProfileUI(updated);
            }
          }
        }
        if (window.App && typeof window.App.renderScreen === 'function') {
          window.App.renderScreen(window.App.currentScreen);
        }
      }
    }, err => console.warn("Users listener failed:", err));
    this.fbListeners.push(unsubUsers);

    // Listen for Sections
    const unsubSections = this.fbDb.collection('sections').onSnapshot(snapshot => {
      const sections = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.name) {
          sections.push(data.name);
        }
      });
      if (sections.length > 0) {
        localStorage.setItem(DB_KEYS.SECTIONS, JSON.stringify(sections));
        if (window.App && typeof window.App.renderScreen === 'function') {
          window.App.renderScreen(window.App.currentScreen);
        }
      }
    }, err => console.warn("Sections listener failed:", err));
    this.fbListeners.push(unsubSections);
  },

  async clearFirestoreCollection(collectionName) {
    if (!this.fbDb) return;
    try {
      const snapshot = await this.fbDb.collection(collectionName).get();
      const batch = this.fbDb.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleared Firestore collection: ${collectionName}`);
    } catch (err) {
      console.warn(`Failed to clear Firestore collection ${collectionName}:`, err);
    }
  },

  // RESET
  reset() {
    localStorage.removeItem(DB_KEYS.STUDENTS);
    localStorage.removeItem(DB_KEYS.ATTENDANCE);
    localStorage.removeItem(DB_KEYS.SETTINGS);
    localStorage.removeItem(DB_KEYS.USERS);
    localStorage.removeItem(DB_KEYS.SECTIONS);
    
    if (this.fbDb) {
      Promise.all([
        this.clearFirestoreCollection('students'),
        this.clearFirestoreCollection('attendance'),
        this.clearFirestoreCollection('users'),
        this.clearFirestoreCollection('sections')
      ]).then(() => {
        this.init();
      });
    } else {
      this.init();
    }
  },

  // STUDENTS CRUD
  getStudents(includeArchived = false) {
    this.init();
    const students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
    return includeArchived ? students : students.filter(s => !s.is_archived);
  },

  getStudentById(id) {
    return this.getStudents(true).find(s => s.id === id);
  },

  getStudentByRfid(rfid) {
    if (!rfid) return null;
    return this.getStudents(false).find(s => s.rfid_uid === rfid.trim().toUpperCase());
  },

  saveStudent(student) {
    const students = this.getStudents(true);
    
    // Ensure gender classification fallback if missing
    if (!student.gender) {
      const nameLower = (student.full_name || '').toLowerCase();
      const isFemale = nameLower.includes('anne') || nameLower.includes('grace') || nameLower.includes('nicole') || nameLower.includes('allysa') || nameLower.includes('elena') || nameLower.includes('sofia') || nameLower.includes('maria') || nameLower.includes('patricia') || nameLower.includes('samantha') || nameLower.includes('antoniette') || nameLower.includes('diorec');
      student.gender = isFemale ? 'F' : 'M';
    }
    
    const index = students.findIndex(s => s.id === student.id);
    
    if (index !== -1) {
      students[index] = { ...students[index], ...student };
    } else {
      // Create new
      if (!student.id) {
        let maxIdNum = 100;
        students.forEach(s => {
          if (s.id && s.id.startsWith('2024-')) {
            const part = s.id.split('-')[1];
            const num = parseInt(part, 10);
            if (!isNaN(num) && num > maxIdNum) {
              maxIdNum = num;
            }
          }
        });
        const nextNum = maxIdNum + 1;
        student.id = '2024-' + String(nextNum).padStart(4, '0');
      }
      if (student.is_archived === undefined) student.is_archived = false;
      students.push(student);
    }
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));

    // Firestore sync
    if (this.fbDb) {
      this.fbDb.collection('students').doc(student.id).set(student, { merge: true })
        .catch(err => {
          console.warn("Firestore saveStudent failed:", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Cloud save failed: ${err.message || err}`);
          }
        });
    }

    return student;
  },

  archiveStudent(id) {
    const students = this.getStudents(true);
    const student = students.find(s => s.id === id);
    if (student) {
      student.is_archived = true;
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
      
      // Firestore sync
      if (this.fbDb) {
        this.fbDb.collection('students').doc(id).set({ is_archived: true }, { merge: true })
          .catch(err => console.warn("Firestore archiveStudent failed:", err));
      }
      return student;
    }
    return null;
  },

  restoreStudent(id) {
    const students = this.getStudents(true);
    const student = students.find(s => s.id === id);
    if (student) {
      student.is_archived = false;
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
      
      // Firestore sync
      if (this.fbDb) {
        this.fbDb.collection('students').doc(id).set({ is_archived: false }, { merge: true })
          .catch(err => console.warn("Firestore restoreStudent failed:", err));
      }
      return student;
    }
    return null;
  },

  deleteStudent(id) {
    let students = this.getStudents(true);
    students = students.filter(s => s.id !== id);
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
    
    // Also clean up student's attendance records
    let attendance = this.getAttendanceAll();
    attendance = attendance.filter(a => a.student_id !== id);
    localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));

    // Firestore delete
    if (this.fbDb) {
      this.fbDb.collection('students').doc(id).delete()
        .catch(err => {
          console.warn("Firestore deleteStudent failed:", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Cloud delete failed: ${err.message || err}`);
          }
        });
      
      this.fbDb.collection('attendance').where('student_id', '==', id).get().then(snapshot => {
        const batch = this.fbDb.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        batch.commit();
      }).catch(err => console.warn("Firestore delete student attendance failed:", err));
    }
  },

  registerRFID(studentId, rfidUid) {
    const students = this.getStudents();
    const rfidUpper = rfidUid.trim().toUpperCase();
    
    // Check if RFID is already linked to another student
    const existing = students.find(s => s.rfid_uid === rfidUpper && s.id !== studentId);
    if (existing) {
      throw new Error(`RFID card is already linked to ${existing.full_name}.`);
    }

    const student = students.find(s => s.id === studentId);
    if (student) {
      student.rfid_uid = rfidUpper;
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));

      // Firestore sync
      if (this.fbDb) {
        this.fbDb.collection('students').doc(studentId).set({ rfid_uid: rfidUpper }, { merge: true })
          .catch(err => {
            console.warn("Firestore registerRFID failed:", err);
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast(`Cloud link RFID failed: ${err.message || err}`);
            }
          });
      }

      return student;
    }
    throw new Error('Student not found.');
  },

  // ATTENDANCE CRUD
  getAttendanceAll() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.ATTENDANCE)) || [];
  },

  getAttendanceByDate(dateStr) {
    return this.getAttendanceAll().filter(a => a.date === dateStr);
  },

  saveAttendanceRecord(record) {
    const attendance = this.getAttendanceAll();
    const session = record.session || 'AM';
    const recordId = record.id || `${record.date}_${session}_${record.student_id}`;
    
    const index = attendance.findIndex(a => a.id === recordId);
    
    const updatedRecord = {
      ...record,
      id: recordId,
      session: session,
      synced: record.synced !== undefined ? record.synced : false // Defaults to false (offline first)
    };

    if (index !== -1) {
      attendance[index] = { ...attendance[index], ...updatedRecord };
    } else {
      attendance.push(updatedRecord);
    }
    
    localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));

    // Firestore sync
    if (this.fbDb) {
      const fbRecord = { ...updatedRecord, synced: true };
      this.fbDb.collection('attendance').doc(recordId).set(fbRecord, { merge: true })
        .then(() => {
          const localAttendance = this.getAttendanceAll();
          const localIdx = localAttendance.findIndex(a => a.id === recordId);
          if (localIdx !== -1) {
            localAttendance[localIdx].synced = true;
            localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(localAttendance));
            if (window.App && typeof window.App.updatePendingSyncCount === 'function') {
              window.App.updatePendingSyncCount();
            }
          }
        })
        .catch(err => {
          console.warn("Firestore saveAttendanceRecord failed:", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Cloud sync log failed: ${err.message || err}`);
          }
        });
    }

    return updatedRecord;
  },

  // USERS / AUTH
  getUsers() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.USERS)) || [];
  },

  login(username, password) {
    const users = this.getUsers();
    if (!username) return null;
    const cleanUsername = username.trim().toLowerCase();
    const user = users.find(u => u.username === cleanUsername && u.password === password);
    if (user) {
      localStorage.setItem(DB_KEYS.ACTIVE_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },

  getActiveUser() {
    return JSON.parse(localStorage.getItem(DB_KEYS.ACTIVE_USER));
  },

  logout() {
    localStorage.removeItem(DB_KEYS.ACTIVE_USER);
  },

  saveUser(user) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.username === user.username.toLowerCase());
    
    user.username = user.username.toLowerCase();
    
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));

    // Firestore sync
    if (this.fbDb) {
      this.fbDb.collection('users').doc(user.username).set(user, { merge: true })
        .catch(err => {
          console.warn("Firestore saveUser failed:", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Cloud user save failed: ${err.message || err}`);
          }
        });
    }

    return user;
  },

  deleteUser(username) {
    let users = this.getUsers();
    users = users.filter(u => u.username !== username.toLowerCase());
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));

    // Firestore delete
    if (this.fbDb) {
      this.fbDb.collection('users').doc(username.toLowerCase()).delete()
        .catch(err => {
          console.warn("Firestore deleteUser failed:", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Cloud user delete failed: ${err.message || err}`);
          }
        });
    }
  },

  changePassword(username, newPassword) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.username === username.toLowerCase());
    if (index !== -1) {
      users[index].password = newPassword;
      users[index].needs_password_reset = false;
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
      
      const activeUser = this.getActiveUser();
      if (activeUser && activeUser.username === username.toLowerCase()) {
        activeUser.password = newPassword;
        activeUser.needs_password_reset = false;
        localStorage.setItem(DB_KEYS.ACTIVE_USER, JSON.stringify(activeUser));
      }

      // Firestore sync
      if (this.fbDb) {
        this.fbDb.collection('users').doc(username.toLowerCase()).set({
          password: newPassword,
          needs_password_reset: false
        }, { merge: true })
        .catch(err => console.warn("Firestore changePassword failed:", err));
      }

      return true;
    }
    return false;
  },

  // SETTINGS
  getSettings() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },

  // ONLINE AUTO-SYNC MANAGER
  getUnsyncedCount() {
    return this.getAttendanceAll().filter(a => !a.synced).length;
  },

  async syncPendingRecords(isRealOnline = true) {
    const attendance = this.getAttendanceAll();
    const unsynced = attendance.filter(a => !a.synced);
    
    if (unsynced.length === 0) return { success: true, count: 0 };
    
    if (this.fbDb) {
      console.log(`Starting Firestore sync of ${unsynced.length} records...`);
      try {
        const batch = this.fbDb.batch();
        unsynced.forEach(rec => {
          const recRef = this.fbDb.collection('attendance').doc(rec.id);
          batch.set(recRef, { ...rec, synced: true }, { merge: true });
        });
        await batch.commit();
        
        // Mark all as synced locally
        unsynced.forEach(rec => {
          rec.synced = true;
          const idx = attendance.findIndex(a => a.id === rec.id);
          if (idx !== -1) attendance[idx].synced = true;
        });
        localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));
        return { success: true, count: unsynced.length };
      } catch (err) {
        console.error("Firestore sync failed:", err);
        throw err;
      }
    }

    console.log(`Starting background sync of ${unsynced.length} records...`);
    const settings = this.getSettings();
    
    try {
      if (settings.mockServerMode || !isRealOnline) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mark all as synced
        unsynced.forEach(rec => {
          rec.synced = true;
          const idx = attendance.findIndex(a => a.id === rec.id);
          if (idx !== -1) attendance[idx].synced = true;
        });
        
        localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));
        return { success: true, count: unsynced.length };
      } else {
        // REAL SYNC ENDPOINT IMPLEMENTATION
        const response = await fetch(settings.serverSyncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classroom: 'Grade 3 - Narra',
            records: unsynced
          })
        });
        
        if (response.ok) {
          unsynced.forEach(rec => {
            rec.synced = true;
            const idx = attendance.findIndex(a => a.id === rec.id);
            if (idx !== -1) attendance[idx].synced = true;
          });
          localStorage.setItem(DB_KEYS.ATTENDANCE, JSON.stringify(attendance));
          return { success: true, count: unsynced.length };
        } else {
          throw new Error(`Cloud server returned status ${response.status}`);
        }
      }
    } catch (err) {
      console.error('Auto-sync failed:', err.message);
      throw err;
    }
  },

  // ANALYTICS COMPUTATION
  getAnalytics(dateStr, sectionFilter, sessionFilter = 'AM') {
    let students = this.getStudents();
    if (sectionFilter) {
      students = students.filter(s => s.grade_section === sectionFilter);
    }
    let allAttendance = this.getAttendanceByDate(dateStr);
    
    if (sessionFilter && sessionFilter !== 'All') {
      allAttendance = allAttendance.filter(a => a.session === sessionFilter);
    }
    
    const attendance = sectionFilter 
      ? allAttendance.filter(a => students.some(s => s.id === a.student_id))
      : allAttendance;
    
    const enrolled = students.length;
    const present = attendance.filter(a => a.status === 'PRESENT').length;
    const late = 0;
    const explicitAbsent = attendance.filter(a => a.status === 'ABSENT').length;
    
    // Determine if the scan deadline has passed
    const settings = this.getSettings();
    const isAM = sessionFilter === 'AM';
    const deadlineTimeStr = isAM ? settings.amDeadline : settings.pmDeadline;
    
    const todayStr = new Date().toISOString().split('T')[0];
    let isDeadlinePassed = false;
    
    if (dateStr < todayStr) {
      isDeadlinePassed = true;
    } else if (dateStr === todayStr) {
      const [h, m] = (deadlineTimeStr || '09:30').split(':').map(Number);
      const deadlineMins = h * 60 + m;
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      if (currentMins > deadlineMins) {
        isDeadlinePassed = true;
      }
    }
    
    const scanned = present + late + explicitAbsent;
    let absent = explicitAbsent;
    let unscanned = enrolled - scanned;
    
    if (isDeadlinePassed) {
      absent += unscanned;
      unscanned = 0;
    }
    
    // Historical Average Attendance
    const allLogs = this.getAttendanceAll();
    let filteredAllLogs = allLogs;
    if (sessionFilter && sessionFilter !== 'All') {
      filteredAllLogs = allLogs.filter(l => l.session === sessionFilter);
    }
    
    // Unique dates
    const dates = [...new Set(filteredAllLogs.map(l => l.date))];
    let avgAttendance = 94; // fallback mockup value
    
    if (dates.length > 0) {
      let totalPresents = 0;
      let totalEntries = 0;
      
      dates.forEach(d => {
        const dayLogs = filteredAllLogs.filter(l => l.date === d && students.some(s => s.id === l.student_id));
        totalPresents += dayLogs.filter(l => l.status === 'PRESENT').length;
        totalEntries += dayLogs.length;
      });
      
      if (totalEntries > 0) {
        avgAttendance = Math.round((totalPresents / totalEntries) * 100);
      }
    }

    return {
      enrolled,
      present,
      late,
      absent,
      scanned,
      unscanned,
      avgAttendance
    };
  },

  // SECTIONS CRUD
  getSections() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.SECTIONS)) || [];
  },

  saveSection(name) {
    const sections = this.getSections();
    const cleanName = name.trim();
    if (!cleanName) return false;
    
    if (sections.includes(cleanName)) {
      return false; // Already exists
    }
    
    sections.push(cleanName);
    localStorage.setItem(DB_KEYS.SECTIONS, JSON.stringify(sections));
    
    // Firestore sync
    if (this.fbDb) {
      this.fbDb.collection('sections').doc(cleanName).set({ name: cleanName })
        .catch(err => console.warn("Firestore saveSection failed:", err));
    }
    return true;
  },

  deleteSection(name) {
    const sections = this.getSections();
    const cleanName = name.trim();
    const updated = sections.filter(s => s !== cleanName);
    localStorage.setItem(DB_KEYS.SECTIONS, JSON.stringify(updated));
    
    // Cascading delete students in this section
    const students = this.getStudents(true);
    students.forEach(student => {
      if (student.grade_section === cleanName) {
        this.deleteStudent(student.id);
      }
    });

    // Cascading delete teachers/advisors in this section
    const users = this.getUsers();
    users.forEach(user => {
      if (!user.is_principal && user.section === cleanName) {
        this.deleteUser(user.username);
      }
    });

    // Firestore delete
    if (this.fbDb) {
      this.fbDb.collection('sections').doc(cleanName).delete()
        .catch(err => console.warn("Firestore deleteSection failed:", err));
    }
    return true;
  },

  // SCHOOL-WIDE SECTION ANALYTICS COMPUTATION FOR PRINCIPAL
  getSchoolAnalytics(dateStr, sessionFilter = 'AM') {
    const students = this.getStudents();
    let attendance = this.getAttendanceByDate(dateStr);
    
    if (sessionFilter && sessionFilter !== 'All') {
      attendance = attendance.filter(a => a.session === sessionFilter);
    }
    
    const users = this.getUsers();
    
    // Get unique sections strictly from managed sections list
    const activeSections = this.getSections();
    const sections = [...activeSections].filter(Boolean).sort();
    
    const sectionBreakdowns = sections.map(section => {
      const sectionStudents = students.filter(s => s.grade_section === section);
      const sectionAttendance = attendance.filter(a => {
        return sectionStudents.some(s => s.id === a.student_id);
      });
      
      const enrolled = sectionStudents.length;
      const present = sectionAttendance.filter(a => a.status === 'PRESENT').length;
      const absent = sectionAttendance.filter(a => a.status === 'ABSENT').length;
      
      const rateToday = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;
      
      // Find advisor for this section
      const advisor = users.find(u => u.section === section);
      
      return {
        section,
        advisorName: advisor ? advisor.display_name : 'No Advisor Assigned',
        enrolled,
        present,
        late: 0,
        absent,
        attendanceRateToday: rateToday
      };
    });
    
    const overallStats = this.getAnalytics(dateStr, undefined, sessionFilter);
    
    return {
      overall: overallStats,
      sections: sectionBreakdowns
    };
  }
};

// Expose Database object to window context
window.Database = Database;
Database.init();
console.log('Offline Database Initialized with Seed Records.');
