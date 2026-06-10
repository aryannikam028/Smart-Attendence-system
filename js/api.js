import { CONFIG } from './config.js?v=9';

// Initialize mock database in localStorage if not present
function initMockDb() {
    if (localStorage.getItem('mock_students_db')) return;
    
    const classmates = [
        'Aryan D Nikam', 'Rahul Sharma', 'Sneha Patil', 'Amit Verma', 'Priya Singh', 
        'Yash Deshmukh', 'Aditi Joshi', 'Rohan Mehta', 'Neha Kulkarni', 
        'Aniket Shinde', 'Pooja Sawant', 'Siddharth Rao', 'Tejaswini Patil', 
        'Vikram Rathod', 'Shruti Shinde'
    ];
    
    const uniqueLabels = ['DCOM(MDP)', 'IOT & I4.0(SRN)', 'AWP(PK)', 'ESD(AP)', 'Practical', 'MPMC(DK)', 'AWP(PK)(T)', 'NPTEL', 'DCOM(MDP)(T)'];
    const colMap = [];
    let col = 7;
    const year = 2026;
    const month = 6;
    
    const TIMETABLE = {
      1: [
        { label: "DCOM(MDP)", time: "10:00-11:00", idx: 0 },
        { label: "IOT & I4.0(SRN)", time: "11:00-12:00", idx: 1 },
        { label: "AWP(PK)", time: "12:40-13:40", idx: 2 },
        { label: "ESD(AP)", time: "13:40-14:40", idx: 3 },
        { label: "Practical", time: "14:50-16:50", idx: 4 }
      ],
      2: [
        { label: "MPMC(DK)", time: "10:00-11:00", idx: 0 },
        { label: "AWP(PK)(T)", time: "11:00-12:00", idx: 1 },
        { label: "ESD(AP)", time: "12:40-13:40", idx: 2 },
        { label: "NPTEL", time: "13:40-14:40", idx: 3 },
        { label: "Practical", time: "14:50-16:50", idx: 4 }
      ],
      3: [
        { label: "DCOM(MDP)", time: "10:00-11:00", idx: 0 },
        { label: "IOT & I4.0(SRN)", time: "11:00-12:00", idx: 1 },
        { label: "MPMC(DK)", time: "12:40-13:40", idx: 2 },
        { label: "AWP(PK)(T)", time: "13:40-14:40", idx: 3 },
        { label: "Practical", time: "14:50-16:50", idx: 4 }
      ],
      4: [
        { label: "DCOM(MDP)", time: "10:00-11:00", idx: 0 },
        { label: "IOT & I4.0(SRN)", time: "11:00-12:00", idx: 1 },
        { label: "ESD(AP)", time: "12:40-13:40", idx: 2 },
        { label: "MPMC(DK)", time: "13:40-14:40", idx: 3 },
        { label: "Practical", time: "14:50-16:50", idx: 4 }
      ],
      5: [
        { label: "MPMC(DK)", time: "10:00-11:00", idx: 0 },
        { label: "IOT & I4.0(SRN)", time: "11:00-12:00", idx: 1 },
        { label: "DCOM(MDP)(T)", time: "12:40-13:40", idx: 2 },
        { label: "AWP(PK)", time: "13:40-14:40", idx: 3 },
        { label: "Practical", time: "14:50-16:50", idx: 4 }
      ]
    };
    
    for (let d = 1; d <= 30; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) {
            colMap.push({ col: col, date: d, dayOfWeek: dow, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), lectureIdx: -1, lectureLabel: dow === 0 ? 'Sunday' : 'Saturday', timeLabel: '', nonWorking: true, nonWorkingLabel: dow === 0 ? 'Sunday' : 'Saturday' });
            col++;
        } else {
            const slots = TIMETABLE[dow] || [];
            slots.forEach(slot => {
                colMap.push({ col: col, date: d, dayOfWeek: dow, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), lectureIdx: slot.idx, lectureLabel: slot.label, timeLabel: slot.time, nonWorking: false });
                col++;
            });
        }
    }
    
    const students = classmates.map((name, i) => {
        const roll = (i + 1).toString().padStart(2, '0');
        const phone = "98765432" + roll;
        const prn = "PRN2026" + roll;
        const password = "pass" + roll;
        
        const attendance = {};
        colMap.forEach(c => {
            if (c.nonWorking) {
                attendance[c.col] = "SUN";
            } else {
                const seed = parseInt(roll) + c.col;
                attendance[c.col] = seed % 8 === 0 ? "A" : (seed % 9 === 0 ? "" : "P");
            }
        });
        
        const summary = {};
        uniqueLabels.forEach(lbl => {
            let p = 0;
            let a = 0;
            colMap.forEach(c => {
                if (c.lectureLabel === lbl && !c.nonWorking) {
                    if (attendance[c.col] === "P") p++;
                    if (attendance[c.col] === "A") a++;
                }
            });
            summary[lbl] = { present: p, absent: a };
        });
        
        return {
            roll: roll,
            name: name,
            phone: phone,
            prn: prn,
            password: password,
            lastScan: "10:15 AM",
            photo: name.includes('Aryan') ? "assets/aryan_1.jpg" : "https://api.dicebear.com/7.x/adventurer/svg?seed=" + roll,
            attendance: attendance,
            summary: summary
        };
    });
    
    localStorage.setItem('mock_students_db', JSON.stringify(students));
    localStorage.setItem('mock_colmap', JSON.stringify(colMap));
    localStorage.setItem('mock_unique_labels', JSON.stringify(uniqueLabels));
}

// Ensure mock DB is initialized
initMockDb();

export const api = {
    async fetchFromGAS(params) {
        const isMockMode = !CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_ID_HERE');

        if (isMockMode) {
            return this.getMockResponse(params);
        }

        const queryString = new URLSearchParams(params).toString();
        const url = `${CONFIG.API_URL}?${queryString}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error, falling back to mock:', error);
            return this.getMockResponse(params);
        }
    },

    async postToGAS(params) {
        const isMockMode = !CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_ID_HERE');

        if (isMockMode) {
            return this.getMockResponse(params);
        }

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(params)
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error, falling back to mock:', error);
            return this.getMockResponse(params);
        }
    },

    getMockResponse(params) {
        const action = params.action;
        const studentsDb = JSON.parse(localStorage.getItem('mock_students_db') || '[]');
        const colMap = JSON.parse(localStorage.getItem('mock_colmap') || '[]');
        const uniqueLabels = JSON.parse(localStorage.getItem('mock_unique_labels') || '[]');

        if (action === 'studentLogin') {
            const roll = (params.roll || "").trim();
            const pass = (params.password || "").trim();
            const student = studentsDb.find(s => s.roll === roll && s.password === pass);

            if (student) {
                return {
                    success: true,
                    roll: student.roll,
                    name: student.name,
                    phone: student.phone,
                    prn: student.prn,
                    lastScan: student.lastScan,
                    summary: student.summary,
                    attendance: student.attendance,
                    photo: student.photo,
                    month: "June 2026",
                    colMap: colMap
                };
            }
            return { success: false, error: "Invalid Roll No or Password" };
        }

        if (action === 'getStudents') {
            return {
                students: studentsDb,
                month: "June 2026",
                colMap: colMap,
                uniqueLabels: uniqueLabels,
                summaryStartCol: 7
            };
        }

        if (action === 'updateStudent') {
            const roll = (params.roll || "").trim();
            const studentIdx = studentsDb.findIndex(s => s.roll === roll);
            
            if (studentIdx !== -1) {
                if (params.name !== undefined) studentsDb[studentIdx].name = params.name;
                if (params.phone !== undefined) studentsDb[studentIdx].phone = params.phone;
                if (params.prn !== undefined) studentsDb[studentIdx].prn = params.prn;
                if (params.password !== undefined) studentsDb[studentIdx].password = params.password;
                if (params.photo !== undefined) studentsDb[studentIdx].photo = params.photo;
                
                // Recalculate summary in case details changed
                localStorage.setItem('mock_students_db', JSON.stringify(studentsDb));
                return { success: true, message: "Profile updated successfully" };
            }
            return { success: false, error: "Student not found" };
        }

        if (action === 'updateAttendance') {
            const roll = (params.roll || "").trim();
            const colNum = parseInt(params.col || "-1");
            const status = (params.status || "").trim().toUpperCase(); // 'P', 'A', or '-'
            
            const studentIdx = studentsDb.findIndex(s => s.roll === roll);
            if (studentIdx !== -1 && colNum !== -1) {
                studentsDb[studentIdx].attendance[colNum] = status;
                
                // Recalculate summary totals
                uniqueLabels.forEach(lbl => {
                    let p = 0;
                    let a = 0;
                    colMap.forEach(c => {
                        if (c.lectureLabel === lbl && !c.nonWorking) {
                            const val = studentsDb[studentIdx].attendance[c.col];
                            if (val === "P") p++;
                            if (val === "A") a++;
                        }
                    });
                    studentsDb[studentIdx].summary[lbl] = { present: p, absent: a };
                });

                localStorage.setItem('mock_students_db', JSON.stringify(studentsDb));
                return { success: true, message: "Attendance cell updated" };
            }
            return { success: false, error: "Student or column not found" };
        }

        return { success: false, error: "Unknown action" };
    },

    /**
     * Login Student (Roll No + Password)
     */
    async studentLogin(roll, password) {
        return await this.fetchFromGAS({
            action: 'studentLogin',
            roll: roll,
            password: password
        });
    },

    /**
     * Get All Students (Admin View)
     */
    async getStudents() {
        return await this.fetchFromGAS({
            action: 'getStudents'
        });
    },

    /**
     * Update Student Profile (Admin or Student photo update)
     */
    async updateStudent(roll, name, phone, prn, password, photo) {
        // If the photo is a Base64 string (extremely long), do not send it to the Google Apps Script backend
        // to prevent exceeding GET URL length constraints (the sheet doesn't store photos anyway).
        const photoToSend = (photo && photo.length > 500) ? "" : photo;

        return await this.fetchFromGAS({
            action: 'updateStudent',
            roll: roll,
            name: name,
            phone: phone,
            prn: prn,
            password: password,
            photo: photoToSend
        });
    },

    /**
     * Update a single cell in attendance sheet
     */
    async updateAttendance(roll, col, status) {
        return await this.fetchFromGAS({
            action: 'updateAttendance',
            roll: roll,
            col: col,
            status: status
        });
    }
};
