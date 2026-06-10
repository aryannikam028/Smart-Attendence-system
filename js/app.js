import { api } from './api.js?v=9';

// Application State
const state = {
    user: null, // { roll, name, phone, prn, photo, password, role }
    attendance: null, // student data overview, subjects, history
    students: [], // admin directory dataset
    colMap: [], // calendar columns
    uniqueLabels: [], // subject list labels
    month: 'June 2026',
    currentPage: 'dashboard',
    theme: localStorage.getItem('theme') || 'light',
    isLoading: false
};

// UI Elements mapping
const ui = {
    loginContainer: document.getElementById('login-container'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    contentArea: document.getElementById('content-area'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    studentName: document.getElementById('student-name'),
    navLinks: document.querySelectorAll('.nav-links .nav-link'),
    logoutBtn: document.getElementById('logout-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    headerName: document.getElementById('header-name'),
    headerPrn: document.getElementById('header-prn'),
    headerPhoto: document.getElementById('header-photo'),
    loader: document.getElementById('global-loader'),
    
    // Modal elements
    editModal: document.getElementById('edit-student-modal'),
    editForm: document.getElementById('edit-student-form'),
    closeEditModal: document.getElementById('close-edit-modal'),
    cancelEditModal: document.getElementById('cancel-edit-modal'),
    editRollKey: document.getElementById('edit-student-roll-key'),
    editName: document.getElementById('edit-student-name'),
    editRoll: document.getElementById('edit-student-roll'),
    editPrn: document.getElementById('edit-student-prn'),
    editPhone: document.getElementById('edit-student-phone'),
    editPassword: document.getElementById('edit-student-password'),
    editPhoto: document.getElementById('edit-student-photo'),
    editFile: document.getElementById('edit-student-file')
};

let activeRole = 'student';

// Initialize App
function init() {
    setupEventListeners();
    applyTheme();
    
    // Check for saved sessions
    const adminSession = localStorage.getItem('admin_session');
    const studentSession = localStorage.getItem('student_session');
    
    if (adminSession) {
        state.user = JSON.parse(adminSession);
        document.body.className = 'role-admin';
        showAdminPortal();
    } else if (studentSession) {
        state.user = JSON.parse(studentSession);
        document.body.className = 'role-student';
        showStudentPortal();
    } else {
        showLogin();
    }
}

function showLogin() {
    ui.loginContainer.style.display = 'flex';
    ui.appContainer.style.display = 'none';
}

function setLoader(loading) {
    state.isLoading = loading;
    if (ui.loader) {
        ui.loader.style.display = loading ? 'flex' : 'none';
    }
}

// Map student response back to visual state
function processStudentAttendanceData(userData) {
    const subjects = [];
    let totalPresent = 0;
    let totalAbsent = 0;

    const summary = userData.summary || {};
    const colMap = userData.colMap || [];
    const attendance = userData.attendance || {};

    // Get list of unique labels from colMap if summary doesn't exist
    const labels = Object.keys(summary).length > 0 
        ? Object.keys(summary) 
        : Array.from(new Set(colMap.filter(c => !c.nonWorking).map(c => c.lectureLabel)));

    labels.forEach(lbl => {
        const counts = summary[lbl] || { present: 0, absent: 0 };
        const p = parseInt(counts.present) || 0;
        const a = parseInt(counts.absent) || 0;
        const tot = p + a;
        const pct = tot > 0 ? Math.round((p / tot) * 100) : 0;
        subjects.push({
            name: lbl,
            present: p,
            absent: a,
            total: tot,
            pct: pct
        });
        totalPresent += p;
        totalAbsent += a;
    });

    const totalLectures = totalPresent + totalAbsent;
    const overallPct = totalLectures > 0 ? Math.round((totalPresent / totalLectures) * 100) : 0;

    const history = [];
    colMap.forEach(col => {
        if (!col.nonWorking) {
            const val = attendance[col.col];
            if (val && val !== '-' && val !== '') {
                history.push({
                    date: `${col.date} ${userData.month || 'June 2026'} (${col.dayName})`,
                    subject: col.lectureLabel,
                    time: col.timeLabel,
                    status: val === 'P' ? 'Present' : 'Absent'
                });
            }
        }
    });
    // Newest scans first
    history.reverse();

    state.attendance = {
        overview: {
            totalLectures: totalLectures,
            present: totalPresent,
            absent: totalAbsent,
            percentage: overallPct
        },
        subjects: subjects,
        history: history
    };
    state.colMap = colMap;
}

// Authenticate student session in background on reload
async function showStudentPortal() {
    ui.loginContainer.style.display = 'none';
    ui.appContainer.style.display = 'flex';
    
    // Load custom photo if saved locally
    const customPhotos = JSON.parse(localStorage.getItem('custom_student_photos') || '{}');
    if (customPhotos[state.user.roll]) {
        state.user.photo = customPhotos[state.user.roll];
    }
    
    // Set placeholder headers
    ui.studentName.textContent = state.user.name;
    ui.headerName.textContent = state.user.name;
    ui.headerPrn.textContent = `PRN: ${state.user.prn}`;
    ui.headerPhoto.src = state.user.photo;

    setLoader(true);
    // Silent re-authentication to refresh data from server/mock
    const response = await api.studentLogin(state.user.roll, state.user.password);
    setLoader(false);
    console.log("showStudentPortal response:", response);

    if (response && response.success) {
        state.user.photo = customPhotos[state.user.roll] || response.photo || state.user.photo;
        state.user.name = response.name;
        state.user.phone = response.phone;
        state.user.prn = response.prn;
        localStorage.setItem('student_session', JSON.stringify(state.user));
        
        ui.studentName.textContent = state.user.name;
        ui.headerName.textContent = state.user.name;
        ui.headerPrn.textContent = `PRN: ${state.user.prn}`;
        ui.headerPhoto.src = state.user.photo;

        processStudentAttendanceData(response);
        
        // Active link highlight
        document.querySelectorAll('.nav-links .nav-link').forEach(link => {
            if (link.getAttribute('data-page') === 'dashboard') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        navigateTo('dashboard');
    } else {
        alert('Failed to refresh session. Loading offline dashboard.');
        // If API fails, mock a basic state to prevent blank screen
        processStudentAttendanceData({
            roll: state.user.roll,
            name: state.user.name,
            prn: state.user.prn,
            attendance: {},
            summary: {},
            colMap: []
        });
        navigateTo('dashboard');
    }
}

// Load and display Admin Portal
async function showAdminPortal() {
    ui.loginContainer.style.display = 'none';
    ui.appContainer.style.display = 'flex';
    
    ui.studentName.textContent = 'Administrator';
    ui.headerName.textContent = 'Admin Console';
    ui.headerPrn.textContent = 'Role: Main Admin';
    ui.headerPhoto.src = state.user.photo;

    const success = await loadAdminData();
    if (success) {
        // Active link highlight
        document.querySelectorAll('.nav-links .nav-link').forEach(link => {
            if (link.getAttribute('data-page') === 'admin-dashboard') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        navigateTo('admin-dashboard');
    } else {
        alert('Failed to connect to backend sheets. Please try again.');
        showLogin();
    }
}

// Load admin directory datasets
async function loadAdminData() {
    setLoader(true);
    const response = await api.getStudents();
    setLoader(false);
    if (response) {
        state.students = response.students || [];
        
        // Merge custom photos from localStorage
        const customPhotos = JSON.parse(localStorage.getItem('custom_student_photos') || '{}');
        state.students.forEach(st => {
            if (customPhotos[st.roll]) {
                st.photo = customPhotos[st.roll];
            }
        });

        state.colMap = response.colMap || [];
        state.uniqueLabels = response.uniqueLabels || [];
        state.month = response.month || "June 2026";
        state.summaryStartCol = response.summaryStartCol || 7;
        return true;
    }
    return false;
}

// Event Listeners setup
function setupEventListeners() {
    const tabStudent = document.getElementById('tab-student');
    const tabAdmin = document.getElementById('tab-admin');
    const groupRoll = document.getElementById('group-roll');
    const groupUsername = document.getElementById('group-username');
    const inputRoll = document.getElementById('login-roll');
    const inputUsername = document.getElementById('login-username');
    const inputPassword = document.getElementById('login-password');

    // Login Role Tab Switchers
    tabStudent.addEventListener('click', () => {
        activeRole = 'student';
        tabStudent.classList.add('active');
        tabAdmin.classList.remove('active');
        groupRoll.style.display = 'block';
        groupUsername.style.display = 'none';
        inputRoll.required = true;
        inputUsername.required = false;
        inputUsername.value = '';
        ui.loginError.textContent = '';
    });

    tabAdmin.addEventListener('click', () => {
        activeRole = 'admin';
        tabAdmin.classList.add('active');
        tabStudent.classList.remove('active');
        groupRoll.style.display = 'none';
        groupUsername.style.display = 'block';
        inputRoll.required = false;
        inputUsername.required = true;
        inputRoll.value = '';
        ui.loginError.textContent = '';
    });

    // Form Submit
    ui.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.loginError.textContent = '';
        
        if (activeRole === 'student') {
            const roll = inputRoll.value.trim();
            const password = inputPassword.value.trim();
            setLoader(true);
            const response = await api.studentLogin(roll, password);
            setLoader(false);
            console.log("Submit studentLogin response:", response);
            
            if (response && response.success) {
                // Merge custom local photo if present
                const customPhotos = JSON.parse(localStorage.getItem('custom_student_photos') || '{}');
                const photo = customPhotos[response.roll] || response.photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${response.roll}`;

                state.user = {
                    roll: response.roll,
                    name: response.name,
                    phone: response.phone,
                    prn: response.prn,
                    photo: photo,
                    password: password,
                    role: 'student'
                };
                localStorage.setItem('student_session', JSON.stringify(state.user));
                document.body.className = 'role-student';
                
                ui.studentName.textContent = state.user.name;
                ui.headerName.textContent = state.user.name;
                ui.headerPrn.textContent = `PRN: ${state.user.prn}`;
                ui.headerPhoto.src = state.user.photo;

                processStudentAttendanceData(response);
                
                ui.loginContainer.style.display = 'none';
                ui.appContainer.style.display = 'flex';
                navigateTo('dashboard');
            } else {
                ui.loginError.textContent = (response && response.error) || 'Invalid Roll No or Password';
            }
        } else {
            const username = inputUsername.value.trim();
            const password = inputPassword.value.trim();
            
            if (username === 'admin' && password === 'admin123') {
                state.user = {
                    name: 'Admin Console',
                    roll: 'admin',
                    prn: 'ADMIN',
                    photo: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
                    role: 'admin'
                };
                localStorage.setItem('admin_session', JSON.stringify(state.user));
                document.body.className = 'role-admin';
                
                showAdminPortal();
            } else {
                ui.loginError.textContent = 'Invalid Admin Username or Password';
            }
        }
    });

    // Sidebar Navigation Toggles
    document.querySelectorAll('.nav-links .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (!state.user) {
                window.location.reload();
                return;
            }
            const page = link.getAttribute('data-page');
            if (page) {
                e.preventDefault();
                document.querySelectorAll('.nav-links .nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                navigateTo(page);
            }
        });
    });

    // Logout Button
    ui.logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('student_session');
        localStorage.removeItem('admin_session');
        window.location.reload();
    });

    // Theme Toggle
    ui.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        applyTheme();
    });

    // Modal Events
    ui.closeEditModal.addEventListener('click', () => ui.editModal.style.display = 'none');
    ui.cancelEditModal.addEventListener('click', () => ui.editModal.style.display = 'none');
    
    // Modal File Upload Handler (Base64 conversion)
    ui.editFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                ui.editPhoto.value = event.target.result; // Set base64 into text input
            };
            reader.readAsDataURL(file);
        }
    });

    // Modal Form Submissions
    ui.editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const roll = ui.editRollKey.value;
        const name = ui.editName.value.trim();
        const phone = ui.editPhone.value.trim();
        const prn = ui.editPrn.value.trim();
        const password = ui.editPassword.value.trim();
        const photo = ui.editPhoto.value.trim();

        setLoader(true);
        const result = await api.updateStudent(roll, name, phone, prn, password, photo);
        setLoader(false);

        if (result && result.success) {
            ui.editModal.style.display = 'none';
            alert('Student details saved successfully!');
            
            // Save custom photo to localStorage locally if it is a Base64 string
            if (photo && photo.length > 500) {
                const customPhotos = JSON.parse(localStorage.getItem('custom_student_photos') || '{}');
                customPhotos[roll] = photo;
                localStorage.setItem('custom_student_photos', JSON.stringify(customPhotos));
            }

            // If the edited student is the current logged-in student, update session info
            if (state.user.role === 'student' && state.user.roll === roll) {
                state.user.name = name;
                state.user.phone = phone;
                state.user.prn = prn;
                state.user.password = password;
                if (photo) state.user.photo = photo;
                localStorage.setItem('student_session', JSON.stringify(state.user));
                
                // Refresh headers
                ui.studentName.textContent = name;
                ui.headerName.textContent = name;
                ui.headerPrn.textContent = `PRN: ${prn}`;
                if (photo) ui.headerPhoto.src = photo;
            }

            // Reload data
            if (state.user.role === 'admin') {
                await loadAdminData();
                renderPage(state.currentPage);
            } else {
                // Relogin student in background to refresh views
                showStudentPortal();
            }
        } else {
            alert('Failed to update student details: ' + ((result && result.error) || 'Server error'));
        }
    });
}

function applyTheme() {
    document.body.setAttribute('data-theme', state.theme);
    const icon = ui.themeToggle.querySelector('i');
    if (icon) {
        icon.className = state.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

function navigateTo(page) {
    state.currentPage = page;
    
    // Ensure header elements match the logged-in role dynamically on every page navigation
    if (state.user) {
        if (state.user.role === 'admin') {
            if (ui.headerName) ui.headerName.textContent = 'Admin Console';
            if (ui.headerPrn) ui.headerPrn.textContent = 'Role: Main Admin';
            if (ui.headerPhoto) ui.headerPhoto.src = state.user.photo || 'https://api.dicebear.com/7.x/bottts/svg?seed=admin';
        } else {
            if (ui.headerName) ui.headerName.textContent = state.user.name;
            if (ui.headerPrn) ui.headerPrn.textContent = `PRN: ${state.user.prn}`;
            if (ui.headerPhoto) ui.headerPhoto.src = state.user.photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${state.user.roll}`;
        }
    }
    
    renderPage(page);
}

function renderPage(page) {
    // Basic Page Title Setting
    let pageTitle = page.charAt(0).toUpperCase() + page.slice(1);
    if (page === 'admin-dashboard') pageTitle = 'Class Overview';
    if (page === 'admin-register') pageTitle = 'Attendance Register';
    if (page === 'admin-directory') pageTitle = 'Student Records';
    
    ui.viewTitle.textContent = pageTitle;
    
    switch(page) {
        // Student pages
        case 'dashboard':
            renderDashboard();
            break;
        case 'subjects':
            renderSubjects();
            break;
        case 'history':
            renderHistory();
            break;
        case 'analytics':
            renderAnalytics();
            break;
        case 'profile':
            renderProfile();
            break;

        // Admin pages
        case 'admin-dashboard':
            renderAdminDashboard();
            break;
        case 'admin-register':
            renderAdminRegister();
            break;
        case 'admin-directory':
            renderAdminDirectory();
            break;
    }
}

// ─────────────────────────────────────────────
//  STUDENT VIEW RENDERERS
// ─────────────────────────────────────────────

function renderDashboard() {
    const { overview } = state.attendance;
    const colorClass = overview.percentage >= 80 ? 'bg-green' : 
                      (overview.percentage >= 75 ? 'bg-orange' : 'bg-red');

    ui.viewSubtitle.innerHTML = `Overall Attendance Standing: <span class="status-badge ${colorClass}">${overview.percentage}%</span>`;

    ui.contentArea.innerHTML = `
        <div class="stats-grid animate-fade">
            <div class="card">
                <div class="card-title">Total Lectures</div>
                <div class="card-value">${overview.totalLectures}</div>
                <div class="card-subtitle text-muted">Conducted this month</div>
            </div>
            <div class="card">
                <div class="card-title">Present</div>
                <div class="card-value" style="color: var(--success)">${overview.present}</div>
                <div class="card-subtitle text-muted">Lectures attended</div>
            </div>
            <div class="card">
                <div class="card-title">Absent</div>
                <div class="card-value" style="color: var(--danger)">${overview.absent}</div>
                <div class="card-subtitle text-muted">Lectures missed</div>
            </div>
            <div class="card ${colorClass}">
                <div class="card-title" style="color: white">Percentage</div>
                <div class="card-value" style="color: white">${overview.percentage}%</div>
                <div class="card-subtitle">Min. Required: 75%</div>
            </div>
        </div>

        <div class="prediction-section animate-fade" style="margin-top: 2rem;">
            <div class="card">
                <h3 style="margin-bottom: 1rem;"><i class="fas fa-magic"></i> Attendance Goal Assistant</h3>
                <div id="prediction-msg"></div>
            </div>
        </div>
    `;
    
    calculatePrediction();
}

function calculatePrediction() {
    const { overview } = state.attendance;
    const target = 75;
    const msgArea = document.getElementById('prediction-msg');
    if (!msgArea) return;
    
    if (overview.percentage >= target) {
        let maxMiss = 0;
        let tempPresent = overview.present;
        let tempTotal = overview.totalLectures;
        
        while (((tempPresent) / (tempTotal + 1)) * 100 >= target) {
            maxMiss++;
            tempTotal++;
        }
        
        msgArea.innerHTML = `
            <div class="alert alert-success" style="margin-top:0;">
                <i class="fas fa-check-circle" style="font-size: 1.5rem;"></i>
                <div>
                    <strong>You are safe!</strong> You can miss up to <strong>${maxMiss}</strong> upcoming lectures and still maintain a percentage above the critical ${target}% mark.
                </div>
            </div>
        `;
    } else {
        let needAttend = 0;
        let tempPresent = overview.present;
        let tempTotal = overview.totalLectures;
        
        while ((tempTotal === 0) || ((tempPresent / tempTotal) * 100 < target)) {
            needAttend++;
            tempPresent++;
            tempTotal++;
        }
        
        msgArea.innerHTML = `
            <div class="alert alert-danger" style="margin-top:0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem;"></i>
                <div>
                    <strong>Action Required!</strong> Your attendance is below the 75% threshold. You must attend the next <strong>${needAttend}</strong> lectures consecutively to recover your standing.
                </div>
            </div>
        `;
    }
}

function renderSubjects() {
    ui.viewSubtitle.textContent = 'Subject-wise Attendance Distribution';
    
    let html = '<div class="stats-grid animate-fade">';
    state.attendance.subjects.forEach(sub => {
        const color = sub.pct >= 75 ? 'var(--success)' : 'var(--danger)';
        html += `
            <div class="card">
                <div class="subject-header" style="display: flex; justify-content: space-between; align-items: start;">
                    <h4 style="margin-bottom: 0.5rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 70%;">${sub.name}</h4>
                    <span class="status-badge" style="background: ${color}20; color: ${color}">${sub.pct}%</span>
                </div>
                <div class="progress-container" style="height: 8px; background: var(--border-color); border-radius: 4px; margin: 1rem 0; overflow: hidden;">
                    <div style="width: ${sub.pct}%; height: 100%; background: ${color}; transition: width 1s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                    <span>Present: ${sub.present}</span>
                    <span>Absent: ${sub.absent}</span>
                    <span>Total: ${sub.total}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    ui.contentArea.innerHTML = html;
}

function renderHistory() {
    ui.viewSubtitle.textContent = 'Complete Log of Daily Scan Activities';
    
    let rows = '';
    state.attendance.history.forEach(rec => {
        const statusClass = rec.status === 'Present' ? 'bg-green' : 'bg-red';
        rows += `
            <tr>
                <td>${rec.date}</td>
                <td><strong>${rec.subject}</strong></td>
                <td>${rec.time}</td>
                <td><span class="status-badge ${statusClass}">${rec.status}</span></td>
            </tr>
        `;
    });

    ui.contentArea.innerHTML = `
        <div class="table-actions animate-fade" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <input type="text" id="history-search" placeholder="Search by subject or date..." 
                   style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); color: var(--text-main);">
            <button class="btn-primary" style="width: auto; padding: 0 1.5rem;" onclick="window.print()">
                <i class="fas fa-print"></i> Print Register
            </button>
        </div>
        <div class="table-container animate-fade" style="max-height: 60vh; overflow-y: auto;">
            <table>
                <thead>
                    <tr>
                        <th style="position: sticky; top: 0; z-index: 1;">Date</th>
                        <th style="position: sticky; top: 0; z-index: 1;">Subject</th>
                        <th style="position: sticky; top: 0; z-index: 1;">Lecture Time</th>
                        <th style="position: sticky; top: 0; z-index: 1;">Status</th>
                    </tr>
                </thead>
                <tbody id="history-body">
                    ${rows ? rows : '<tr><td colspan="4" style="text-align:center;">No attendance history records found.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    // History filter query logic
    const searchInput = document.getElementById('history-search');
    const historyBody = document.getElementById('history-body');
    if (searchInput && historyBody) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const trs = historyBody.querySelectorAll('tr');
            trs.forEach(tr => {
                if (tr.cells.length < 4) return;
                const dateText = tr.cells[0].textContent.toLowerCase();
                const subText = tr.cells[1].textContent.toLowerCase();
                if (dateText.includes(q) || subText.includes(q)) {
                    tr.style.display = '';
                } else {
                    tr.style.display = 'none';
                }
            });
        });
    }
}

function renderAnalytics() {
    ui.viewSubtitle.textContent = 'Attendance Performance Visualization';
    ui.contentArea.innerHTML = `
        <div class="stats-grid animate-fade" style="grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));">
            <div class="card" style="min-height: 320px;">
                <h3 style="margin-bottom: 1.5rem;">Subject Percentage Comparison</h3>
                <div style="position: relative; height: 250px;"><canvas id="subjectChart"></canvas></div>
            </div>
            <div class="card" style="min-height: 320px;">
                <h3 style="margin-bottom: 1.5rem;">Attendance Ratio Distribution</h3>
                <div style="position: relative; height: 250px; display: flex; justify-content: center;"><canvas id="distributionChart" style="max-width: 250px;"></canvas></div>
            </div>
        </div>
    `;
    setTimeout(initCharts, 150);
}

function initCharts() {
    const ctx1 = document.getElementById('subjectChart');
    const ctx2 = document.getElementById('distributionChart');
    if (!ctx1 || !ctx2) return;

    const labels = state.attendance.subjects.map(s => s.name);
    const data = state.attendance.subjects.map(s => s.pct);

    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance %',
                data: data,
                backgroundColor: 'rgba(37, 99, 235, 0.65)',
                borderColor: 'rgb(37, 99, 235)',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [state.attendance.overview.present, state.attendance.overview.absent],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderProfile() {
    ui.viewSubtitle.textContent = 'Account Info & Settings';
    const u = state.user;
    
    ui.contentArea.innerHTML = `
        <div class="card animate-fade" style="max-width: 650px; margin: 0 auto; padding: 2.5rem;">
            <div style="text-align: center; margin-bottom: 2rem; position: relative;">
                <div style="display: inline-block; position: relative;">
                    <img src="${u.photo}" id="profile-display-img" style="width: 130px; height: 130px; border-radius: 50%; border: 4px solid var(--primary-light); object-fit: cover;">
                    <label for="profile-upload-file" style="position: absolute; bottom: 5px; right: 5px; background: var(--primary-main); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid white; box-shadow: var(--shadow-md); transition: var(--transition);">
                        <i class="fas fa-camera"></i>
                    </label>
                    <input type="file" id="profile-upload-file" accept="image/*" style="display: none;">
                </div>
                <h2 style="margin-top: 1rem; font-weight: 800;">${u.name}</h2>
                <p class="text-muted" style="font-weight: 500;">Roll Number: ${u.roll}</p>
            </div>
            
            <div class="form-grid" style="padding: 0; border: none; margin-bottom: 1.5rem;">
                <div class="form-group">
                    <label class="text-muted text-xs">PRN No</label>
                    <input type="text" value="${u.prn}" disabled style="font-weight: 600; opacity: 0.85;">
                </div>
                <div class="form-group">
                    <label class="text-muted text-xs">Parent Phone</label>
                    <input type="text" id="profile-parent-phone" value="${u.phone || ''}" style="font-weight: 600;">
                </div>
                <div class="form-group">
                    <label class="text-muted text-xs">Password</label>
                    <input type="text" id="profile-password" value="${u.password || ''}" style="font-weight: 600;">
                </div>
                <div class="form-group">
                    <label class="text-muted text-xs">Student Name</label>
                    <input type="text" value="${u.name}" disabled style="font-weight: 600; opacity: 0.85;">
                </div>
            </div>
            
            <div style="text-align: right;">
                <button type="button" id="save-profile-btn" class="btn-primary" style="width: auto; padding: 0.75rem 2rem;">Save Profile Settings</button>
            </div>
        </div>
    `;

    // Hook up local change file upload
    const uploadInput = document.getElementById('profile-upload-file');
    const displayImg = document.getElementById('profile-display-img');
    let base64Photo = u.photo;

    if (uploadInput && displayImg) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    base64Photo = event.target.result;
                    displayImg.src = base64Photo;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Hook up Save Button
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const newPhone = document.getElementById('profile-parent-phone').value.trim();
            const newPassword = document.getElementById('profile-password').value.trim();

            if (!/^[0-9]{10}$/.test(newPhone)) {
                alert('Please enter a valid 10-digit Parent Phone Number.');
                return;
            }
            if (!newPassword) {
                alert('Password cannot be empty.');
                return;
            }

            setLoader(true);
            // In student mode, update their details
            const result = await api.updateStudent(u.roll, u.name, newPhone, u.prn, newPassword, base64Photo);
            setLoader(false);

            if (result && result.success) {
                alert('Profile updated successfully!');
                
                // Save custom photo to localStorage locally if it is a Base64 string
                if (base64Photo && base64Photo.length > 500) {
                    const customPhotos = JSON.parse(localStorage.getItem('custom_student_photos') || '{}');
                    customPhotos[u.roll] = base64Photo;
                    localStorage.setItem('custom_student_photos', JSON.stringify(customPhotos));
                }
                
                // Update Session info
                state.user.phone = newPhone;
                state.user.password = newPassword;
                state.user.photo = base64Photo;
                localStorage.setItem('student_session', JSON.stringify(state.user));
                
                // Refresh Top Header
                ui.headerPrn.textContent = `PRN: ${u.prn}`;
                ui.headerPhoto.src = base64Photo;
                
                showStudentPortal();
            } else {
                alert('Failed to save settings: ' + ((result && result.error) || 'Server rejected request.'));
            }
        });
    }
}


// ─────────────────────────────────────────────
//  ADMIN VIEW RENDERERS
// ─────────────────────────────────────────────

function renderAdminDashboard() {
    // Calculate aggregate statistics
    const totalStudents = state.students.length;
    const totalClasses = state.colMap.filter(c => !c.nonWorking).length;
    
    let totalPresentSum = 0;
    let totalPossibleSum = 0;
    let defaultersCount = 0;
    const studentAverages = [];

    state.students.forEach(st => {
        let p = 0;
        let a = 0;
        Object.values(st.summary || {}).forEach(counts => {
            p += parseInt(counts.present) || 0;
            a += parseInt(counts.absent) || 0;
        });
        const total = p + a;
        const pct = total > 0 ? Math.round((p / total) * 100) : 0;
        
        studentAverages.push({
            roll: st.roll,
            name: st.name,
            pct: pct,
            present: p,
            absent: a,
            phone: st.phone
        });

        totalPresentSum += p;
        totalPossibleSum += total;
        if (pct < 75) {
            defaultersCount++;
        }
    });

    const averageAttendance = totalPossibleSum > 0 
        ? Math.round((totalPresentSum / totalPossibleSum) * 100) 
        : 0;

    const colorClass = averageAttendance >= 75 ? 'bg-green' : 'bg-red';

    ui.viewSubtitle.innerHTML = `Main Class Metric Summaries for <strong>${state.month}</strong>`;

    // Sort to find top performers & defaulters
    const topPerformers = [...studentAverages].sort((a, b) => b.pct - a.pct).slice(0, 5);
    const bottomPerformers = [...studentAverages].filter(s => s.pct < 75).sort((a, b) => a.pct - b.pct);

    ui.contentArea.innerHTML = `
        <div class="stats-grid animate-fade">
            <div class="card">
                <div class="card-title">Total Class Size</div>
                <div class="card-value">${totalStudents}</div>
                <div class="card-subtitle text-muted">Students registered</div>
            </div>
            <div class="card">
                <div class="card-title">Lectures Conducted</div>
                <div class="card-value">${totalClasses}</div>
                <div class="card-subtitle text-muted">Active slots this month</div>
            </div>
            <div class="card">
                <div class="card-title">Defaulter Students</div>
                <div class="card-value" style="color: var(--danger)">${defaultersCount}</div>
                <div class="card-subtitle text-muted">Attendance under 75%</div>
            </div>
            <div class="card ${colorClass}">
                <div class="card-title" style="color: white">Class Average</div>
                <div class="card-value" style="color: white">${averageAttendance}%</div>
                <div class="card-subtitle">Normal goal: 75%+</div>
            </div>
        </div>

        <div class="stats-grid animate-fade" style="grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); margin-top: 2rem;">
            <!-- Top Performers Card -->
            <div class="card">
                <h3 style="margin-bottom: 1rem;"><i class="fas fa-trophy" style="color: var(--warning)"></i> Top Performers (Best Attendance)</h3>
                <div class="table-container" style="box-shadow: none; margin: 0; border: none;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="background: transparent; border: none; color: var(--text-muted);">Roll</th>
                                <th style="background: transparent; border: none; color: var(--text-muted);">Name</th>
                                <th style="background: transparent; border: none; color: var(--text-muted); text-align: right;">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topPerformers.map(s => `
                                <tr>
                                    <td style="border: none; padding: 0.5rem 0;">#${s.roll}</td>
                                    <td style="border: none; padding: 0.5rem 0;"><strong>${s.name}</strong></td>
                                    <td style="border: none; padding: 0.5rem 0; text-align: right; color: var(--success); font-weight: bold;">${s.pct}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Defaulters Card -->
            <div class="card">
                <h3 style="margin-bottom: 1rem;"><i class="fas fa-exclamation-circle" style="color: var(--danger)"></i> Defaulters List (&lt;75%)</h3>
                <div class="table-container" style="box-shadow: none; margin: 0; border: none; max-height: 250px; overflow-y: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="background: transparent; border: none; color: var(--text-muted);">Roll</th>
                                <th style="background: transparent; border: none; color: var(--text-muted);">Name</th>
                                <th style="background: transparent; border: none; color: var(--text-muted); text-align: right;">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bottomPerformers.length > 0 ? bottomPerformers.map(s => `
                                <tr>
                                    <td style="border: none; padding: 0.5rem 0;">#${s.roll}</td>
                                    <td style="border: none; padding: 0.5rem 0;"><strong>${s.name}</strong></td>
                                    <td style="border: none; padding: 0.5rem 0; text-align: right; color: var(--danger); font-weight: bold;">${s.pct}%</td>
                                </tr>
                            `).join('') : `<tr><td colspan="3" style="text-align: center; border: none; color: var(--text-muted);">No students are currently below 75%. Good job!</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderAdminRegister() {
    ui.viewSubtitle.textContent = 'Google Sheets-style Class Register (Click and edit attendance directly)';
    
    // Build Headers
    let headerRow1 = `<tr><th rowspan="2">Roll No</th><th rowspan="2">Student Name</th>`;
    let headerRow2 = `<tr>`;

    state.colMap.forEach(c => {
        if (c.nonWorking) {
            headerRow1 += `<th style="background: #94a3b8; color: white;" title="${c.nonWorkingLabel}">${c.dayName} ${c.date}</th>`;
        } else {
            headerRow1 += `<th style="background: var(--primary-main); color: white;" title="${c.lectureLabel} (${c.timeLabel})">${c.date}</th>`;
        }
    });
    headerRow1 += `</tr>`;
    headerRow2 += `</tr>`;

    // Build Student Rows
    let rowsHtml = '';
    state.students.forEach(st => {
        let cells = `<td>${st.roll}</td><td><strong>${st.name}</strong></td>`;
        state.colMap.forEach(c => {
            if (c.nonWorking) {
                cells += `<td style="background: var(--bg-main); color: var(--text-muted); font-size: 0.75rem; font-style: italic;">${c.nonWorkingLabel.substring(0, 3).toUpperCase()}</td>`;
            } else {
                const currentStatus = st.attendance[c.col] || '';
                
                let selectClass = 'unmarked-status';
                if (currentStatus === 'P') selectClass = 'p-status';
                if (currentStatus === 'A') selectClass = 'a-status';

                cells += `
                    <td>
                        <select class="register-select ${selectClass}" data-roll="${st.roll}" data-col="${c.col}">
                            <option value="-" ${currentStatus !== 'P' && currentStatus !== 'A' ? 'selected' : ''}>-</option>
                            <option value="P" ${currentStatus === 'P' ? 'selected' : ''}>P</option>
                            <option value="A" ${currentStatus === 'A' ? 'selected' : ''}>A</option>
                        </select>
                    </td>
                `;
            }
        });

        rowsHtml += `<tr>${cells}</tr>`;
    });

    ui.contentArea.innerHTML = `
        <div class="table-actions animate-fade" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;">
            <div class="search-wrapper" style="flex: 1; min-width: 280px; max-width: 400px; display: flex; align-items: center; gap: 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0 0.75rem; background: var(--bg-card);">
                <i class="fas fa-search" style="color: var(--text-muted);"></i>
                <input type="text" id="register-search" placeholder="Search student name or roll..." 
                       style="border: none; outline: none; background: transparent; padding: 0.75rem 0; width: 100%; color: var(--text-main);">
            </div>
            <div class="action-buttons" style="display: flex; gap: 0.75rem;">
                <button id="btn-print-register" class="btn-primary" style="width: auto; padding: 0.75rem 1.5rem; background: var(--primary-main); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-print"></i> Print Register
                </button>
                <button id="btn-pdf-summary" class="btn-primary" style="width: auto; padding: 0.75rem 1.5rem; background: #dc2626; border-color: #dc2626; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-file-pdf"></i> PDF Summary Report
                </button>
            </div>
        </div>
        <div class="card animate-fade" style="padding: 1rem;">
            <div class="register-table-wrapper">
                <table class="register-table">
                    <thead>
                        ${headerRow1}
                    </thead>
                    <tbody>
                        ${rowsHtml ? rowsHtml : '<tr><td colspan="50">No student rows loaded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Hook up print & PDF export handlers
    const printBtn = document.getElementById('btn-print-register');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    const pdfBtn = document.getElementById('btn-pdf-summary');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            generateSummaryPDF();
        });
    }

    // Hook up local search filter
    const searchInput = document.getElementById('register-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const trs = ui.contentArea.querySelectorAll('.register-table tbody tr');
            trs.forEach(tr => {
                const roll = tr.cells[0]?.textContent.toLowerCase() || '';
                const name = tr.cells[1]?.textContent.toLowerCase() || '';
                if (name.includes(q) || roll.includes(q)) {
                    tr.style.display = '';
                } else {
                    tr.style.display = 'none';
                }
            });
        });
    }

    // Hook up interactive cell dropdowns
    const dropdowns = ui.contentArea.querySelectorAll('.register-select');
    dropdowns.forEach(select => {
        select.addEventListener('change', async (e) => {
            const roll = select.getAttribute('data-roll');
            const col = select.getAttribute('data-col');
            const val = select.value;

            // Optimistically update local dropdown color class
            select.className = 'register-select';
            if (val === 'P') select.classList.add('p-status');
            if (val === 'A') select.classList.add('a-status');
            if (val === '-') select.classList.add('unmarked-status');

            // Save to server background
            const result = await api.updateAttendance(roll, col, val);
            if (result && result.success) {
                // Update state database cache directly to prevent visual jumping
                const student = state.students.find(s => s.roll === roll);
                if (student) {
                    student.attendance[col] = val;
                    
                    // Recalculate summary metrics for this student
                    state.uniqueLabels.forEach(lbl => {
                        let p = 0;
                        let a = 0;
                        state.colMap.forEach(c => {
                            if (c.lectureLabel === lbl && !c.nonWorking) {
                                const stat = student.attendance[c.col];
                                if (stat === 'P') p++;
                                if (stat === 'A') a++;
                            }
                        });
                        student.summary[lbl] = { present: p, absent: a };
                    });
                }
            } else {
                alert('Failed to save attendance value to sheet backend: ' + ((result && result.error) || 'Network error'));
                // Revert reload
                await loadAdminData();
                renderAdminRegister();
            }
        });
    });
}

function renderAdminDirectory() {
    ui.viewSubtitle.textContent = 'Class Students Profile Register and Login Credentials';

    let cardsHtml = '';
    state.students.forEach(st => {
        const photo = st.photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${st.roll}`;
        cardsHtml += `
            <div class="card student-directory-card animate-fade" style="display: flex; gap: 1.25rem; align-items: center;">
                <img src="${photo}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-light);">
                <div style="flex: 1; min-width: 0;">
                    <h4 style="margin: 0; font-weight: 700; font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${st.name}</h4>
                    <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
                        Roll No: <strong>${st.roll}</strong> | PRN: <strong>${st.prn}</strong>
                    </p>
                    <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
                        Parent Phone: <strong>${st.phone}</strong> | PW: <strong>${st.password}</strong>
                    </p>
                </div>
                <button class="btn-primary edit-student-btn" data-roll="${st.roll}" style="width: auto; padding: 0.5rem 1rem; font-size: 0.8rem;">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;
    });

    ui.contentArea.innerHTML = `
        <div class="table-actions animate-fade" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <input type="text" id="directory-search" placeholder="Search students by roll, name, or PRN..." 
                   style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); color: var(--text-main);">
        </div>
        <div id="directory-container" class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
            ${cardsHtml ? cardsHtml : '<p style="grid-column: 1/-1; text-align:center; padding: 2rem;">No students loaded.</p>'}
        </div>
    `;

    // Hook up search filter
    const searchInput = document.getElementById('directory-search');
    const directoryContainer = document.getElementById('directory-container');
    if (searchInput && directoryContainer) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const cards = directoryContainer.querySelectorAll('.student-directory-card');
            
            cards.forEach(card => {
                const infoText = card.textContent.toLowerCase();
                if (infoText.includes(q)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // Hook up modal editing trigger
    const editButtons = ui.contentArea.querySelectorAll('.edit-student-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const roll = btn.getAttribute('data-roll');
            const student = state.students.find(s => s.roll === roll);
            
            if (student) {
                // Populate inputs
                ui.editRollKey.value = student.roll;
                ui.editRoll.value = student.roll;
                ui.editName.value = student.name;
                ui.editPrn.value = student.prn;
                ui.editPhone.value = student.phone;
                ui.editPassword.value = student.password;
                ui.editPhoto.value = student.photo || '';
                
                // Show modal
                ui.editModal.style.display = 'flex';
            }
        });
    });
}

// ─────────────────────────────────────────────
//  PDF GENERATION HELPER (jsPDF)
// ─────────────────────────────────────────────
function generateSummaryPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert("jsPDF library is not loaded. Please check your internet connection.");
        return;
    }
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape, A4 size
    
    // Set font
    doc.setFont("helvetica");
    
    // Header Banner
    doc.setFillColor(26, 35, 126); // Primary Navy Blue
    doc.rect(0, 0, 297, 24, "F");
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SMART ATTENDANCE PORTAL - CLASS REPORT", 14, 15);
    
    // Metadata Info block
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Month: ${state.month}`, 14, 32);
    doc.text(`Generated Date: ${new Date().toLocaleDateString('en-US')}`, 14, 37);
    doc.text(`Total Students: ${state.students.length}`, 14, 42);
    
    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 46, 283, 46);
    
    // Table Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 50, 269, 8, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 50, 269, 8);
    
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    
    doc.text("Roll", 18, 55);
    doc.text("Student Name", 32, 55);
    doc.text("Parent Phone", 100, 55);
    doc.text("Lectures Attended", 155, 55);
    doc.text("Lectures Missed", 192, 55);
    doc.text("Total Lectures", 228, 55);
    doc.text("Overall %", 262, 55);
    
    let y = 64;
    doc.setFont("helvetica", "normal");
    
    state.students.forEach(st => {
        // Page break logic (A4 height is 210mm, Landscape)
        if (y > 185) {
            doc.addPage('l', 'mm', 'a4');
            
            // Draw header on new page
            doc.setFillColor(26, 35, 126);
            doc.rect(0, 0, 297, 18, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("SMART ATTENDANCE PORTAL - CLASS REPORT (Continued)", 14, 11);
            
            // Draw table headers on new page
            doc.setFillColor(241, 245, 249);
            doc.rect(14, 23, 269, 8, "F");
            doc.setDrawColor(203, 213, 225);
            doc.rect(14, 23, 269, 8);
            doc.setTextColor(51, 65, 85);
            doc.text("Roll", 18, 28);
            doc.text("Student Name", 32, 28);
            doc.text("Parent Phone", 100, 28);
            doc.text("Lectures Attended", 155, 28);
            doc.text("Lectures Missed", 192, 28);
            doc.text("Total Lectures", 228, 28);
            doc.text("Overall %", 262, 28);
            
            y = 37;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
        }
        
        // Calculate attendance aggregate stats
        let p = 0;
        let a = 0;
        Object.values(st.summary || {}).forEach(counts => {
            p += parseInt(counts.present) || 0;
            a += parseInt(counts.absent) || 0;
        });
        const total = p + a;
        const pct = total > 0 ? Math.round((p / total) * 100) : 0;
        
        // Draw row border
        doc.setDrawColor(241, 245, 249);
        doc.line(14, y + 2, 283, y + 2);
        
        doc.setTextColor(51, 65, 85);
        doc.text(st.roll.toString(), 18, y);
        doc.setFont("helvetica", "bold");
        doc.text(st.name, 32, y);
        doc.setFont("helvetica", "normal");
        doc.text(st.phone ? st.phone.toString() : "-", 100, y);
        doc.text(p.toString(), 165, y);
        doc.text(a.toString(), 200, y);
        doc.text(total.toString(), 235, y);
        
        // Dynamic color formatting for standing percentage
        if (pct >= 75) {
            doc.setTextColor(16, 185, 129); // Success Green
        } else {
            doc.setTextColor(239, 68, 68); // Danger Red
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${pct}%`, 262, y);
        doc.setFont("helvetica", "normal");
        
        y += 8;
    });
    
    // Download the PDF
    doc.save(`Attendance_Summary_Report_${state.month.replace(' ', '_')}.pdf`);
}

// Start Web Application
init();
