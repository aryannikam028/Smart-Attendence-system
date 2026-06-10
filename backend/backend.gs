/**
 * Google Apps Script Backend for Smart Attendance System (v7 Optimized)
 * Connects the Fingerprint ESP8266 system to the Student Portal.
 * Columns: Roll No | Name | Last Scan Time | Phone | PRN No | Password | [Day-Lec]... | Summary
 */

var TIMEZONE         = "Asia/Kolkata";
var SHEET_NAME       = "Attendance";
var FAST2SMS_API_KEY = "9bWtGvxAE6kpBdRleYuahsTQXnL8I1VwS4K3MP7m5zqyJ2roNU7IuN52SosHlZWULzjD9C0kpqTJtYQy"; // 🔑 Free at https://fast2sms.com

// ─────────────────────────────────────────────
//  COLUMN CONSTANTS (fixed columns)
// ─────────────────────────────────────────────
var COL_ROLL       = 1;
var COL_NAME       = 2;
var COL_TIME       = 3;
var COL_PHONE      = 4;
var COL_PRN        = 5; // ✅ PRN No
var COL_PASSWORD   = 6; // ✅ Password
var COL_DAYS_START = 7; // Lecture columns start here

var HEADER_ROW_MONTH   = 1;
var HEADER_ROW_TIME    = 2;
var HEADER_ROW_DAY     = 3;
var STUDENT_START_ROW  = 4;

// ─────────────────────────────────────────────
//  TIMETABLE DEFINITION
// ─────────────────────────────────────────────
var TIMETABLE = {
  1: [
    { label: "DCOM(MDP)",        startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  practical: false },
    { label: "IOT & I4.0(SRN)", startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  practical: false },
    { label: "AWP(PK)",          startHour: 12, startMin: 40, endHour: 13, endMin: 40, practical: false },
    { label: "ESD(AP)",          startHour: 13, startMin: 40, endHour: 14, endMin: 40, practical: false },
    { label: "Practical",        startHour: 14, startMin: 50, endHour: 16, endMin: 50, practical: true  }
  ],
  2: [
    { label: "MPMC(DK)",         startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  practical: false },
    { label: "AWP(PK)(T)",       startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  practical: false },
    { label: "ESD(AP)",          startHour: 12, startMin: 40, endHour: 13, endMin: 40, practical: false },
    { label: "NPTEL",            startHour: 13, startMin: 40, endHour: 14, endMin: 40, practical: false },
    { label: "Practical",        startHour: 14, startMin: 50, endHour: 16, endMin: 50, practical: true  }
  ],
  3: [
    { label: "DCOM(MDP)",        startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  practical: false },
    { label: "IOT & I4.0(SRN)", startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  practical: false },
    { label: "MPMC(DK)",         startHour: 12, startMin: 40, endHour: 13, endMin: 40, practical: false },
    { label: "AWP(PK)(T)",       startHour: 13, startMin: 40, endHour: 14, endMin: 40, practical: false },
    { label: "Practical",        startHour: 14, startMin: 50, endHour: 16, endMin: 50, practical: true  }
  ],
  4: [
    { label: "DCOM(MDP)",        startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  practical: false },
    { label: "IOT & I4.0(SRN)", startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  practical: false },
    { label: "ESD(AP)",          startHour: 12, startMin: 40, endHour: 13, endMin: 40, practical: false },
    { label: "MPMC(DK)",         startHour: 13, startMin: 40, endHour: 14, endMin: 40, practical: false },
    { label: "Practical",        startHour: 14, startMin: 50, endHour: 16, endMin: 50, practical: true  }
  ],
  5: [
    { label: "MPMC(DK)",         startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  practical: false },
    { label: "IOT & I4.0(SRN)", startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  practical: false },
    { label: "DCOM(MDP)(T)",     startHour: 12, startMin: 40, endHour: 13, endMin: 40, practical: false },
    { label: "AWP(PK)",          startHour: 13, startMin: 40, endHour: 14, endMin: 40, practical: false },
    { label: "Practical",        startHour: 14, startMin: 50, endHour: 16, endMin: 50, practical: true  }
  ]
};

// ─────────────────────────────────────────────
//  INDIAN FESTIVAL FALLBACK LIST
// ─────────────────────────────────────────────
var INDIAN_FESTIVALS = {
  "01-14": "Makar Sankranti", "01-15": "Pongal",
  "01-23": "Netaji Jayanti",  "01-26": "Republic Day",
  "02-19": "Shivaji Maharaj Jayanti",
  "03-17": "Holi",            "03-25": "Gudi Padwa",
  "03-30": "Eid ul-Fitr",     "04-03": "Good Friday",
  "04-14": "Dr. Ambedkar Jayanti",
  "05-01": "Buddha Pournima", "05-27": "Bakari Eid",
  "06-26": "Moharam",         "07-01": "Muharram",
  "08-09": "Raksha Bandhan",  "08-15": "Independence Day",
  "08-16": "Janmashtami",     "08-27": "Onam",
  "09-05": "Teachers Day",    "09-07": "Ganesh Chaturthi",
  "10-02": "Gandhi Jayanti",  "10-11": "Dussehra",
  "10-20": "Diwali",          "10-21": "Diwali",
  "10-31": "Sardar Patel Jayanti",
  "11-01": "Diwali/New Year", "11-05": "Guru Nanak Jayanti",
  "11-15": "Jharkhand Sthapna Diwas",
  "12-25": "Christmas Day",   "12-26": "Public Holiday"
};

// ─────────────────────────────────────────────
//  HOLIDAY FETCH
// ─────────────────────────────────────────────
function fetchHolidaysForMonth(year, month) {
  var cacheKey = "HOL_" + year + "_" + month;
  var cached   = PropertiesService.getScriptProperties().getProperty(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  var holidays = {};
  for (var key in INDIAN_FESTIVALS) {
    var p = key.split("-");
    if (parseInt(p[0]) === month) holidays[parseInt(p[1]).toString()] = INDIAN_FESTIVALS[key];
  }
  try {
    var url  = "https://date.nager.at/api/v3/PublicHolidays/" + year + "/IN";
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      JSON.parse(resp.getContentText()).forEach(function(h) {
        var dp = h.date.split("-");
        if (parseInt(dp[1]) === month) holidays[parseInt(dp[2]).toString()] = h.localName || h.name;
      });
    }
  } catch(err) { Logger.log("Holiday fetch error: " + err); }

  PropertiesService.getScriptProperties().setProperty(cacheKey, JSON.stringify(holidays));
  return holidays;
}

function getNonWorkingLabel(date, holidays) {
  var dow = date.getDay();
  if (dow === 0) return "Sunday";
  if (dow === 6) return "Saturday";
  var dd = date.getDate().toString();
  return (holidays && holidays[dd]) ? holidays[dd] : null;
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function getDaysInCurrentMonth() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getMonthLabel() {
  return Utilities.formatDate(new Date(), TIMEZONE, "MMMM yyyy");
}

function columnToLetter(col) {
  var letter = '';
  while (col > 0) {
    var temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

function getSavedSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty("ATTENDANCE_SS_ID");
}

function saveSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty("ATTENDANCE_SS_ID", id);
}

function getSheet() {
  var ssId = getSavedSpreadsheetId();
  var ss, sheet;
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); sheet = ss.getSheetByName(SHEET_NAME); }
    catch(e) { ss = null; sheet = null; }
  }
  if (!sheet) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  }
  return sheet;
}

function padTime(h, m) {
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

// ─────────────────────────────────────────────
//  BUILD COLUMN MAP
// ─────────────────────────────────────────────
function buildColumnMap(year, month, daysInMonth, holidays) {
  var colMap = [];
  var col = COL_DAYS_START;

  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(year, month - 1, d);
    var label = getNonWorkingLabel(date, holidays);
    var dow = date.getDay();

    if (label) {
      colMap.push({
        col: col, date: d, dayOfWeek: dow,
        dayName: Utilities.formatDate(date, TIMEZONE, "EEE"),
        lectureIdx: -1, lectureLabel: label, timeLabel: "",
        nonWorking: true, nonWorkingLabel: label
      });
      col++;
    } else {
      var slots = TIMETABLE[dow] || [];
      slots.forEach(function(slot, idx) {
        colMap.push({
          col: col, date: d, dayOfWeek: dow,
          dayName: Utilities.formatDate(date, TIMEZONE, "EEE"),
          lectureIdx: idx, lectureLabel: slot.label,
          timeLabel: padTime(slot.startHour, slot.startMin) + "-" + padTime(slot.endHour, slot.endMin),
          nonWorking: false, practical: slot.practical,
          endHour: slot.endHour, endMin: slot.endMin
        });
        col++;
      });
    }
  }

  var uniqueLabels = [];
  colMap.forEach(function(c) {
    if (!c.nonWorking && uniqueLabels.indexOf(c.lectureLabel) === -1)
      uniqueLabels.push(c.lectureLabel);
  });

  var summaryStartCol = col;
  return { colMap: colMap, summaryStartCol: summaryStartCol, uniqueLabels: uniqueLabels };
}

// ─────────────────────────────────────────────
//  SUMMARY FORMULA BUILDERS
// ─────────────────────────────────────────────
function buildSummaryFormulas(row, colMap, uniqueLabels, summaryStartCol) {
  return uniqueLabels.map(function(lbl) {
    var cols = colMap.filter(function(c) { return !c.nonWorking && c.lectureLabel === lbl; })
                     .map(function(c) { return columnToLetter(c.col) + row; });
    var pf = cols.length ? "=" + cols.map(function(r) { return 'COUNTIF(' + r + ',"P")'; }).join("+") : '=""';
    var af = cols.length ? "=" + cols.map(function(r) { return 'COUNTIF(' + r + ',"A")'; }).join("+") : '=""';
    return { label: lbl, presentFormula: pf, absentFormula: af };
  });
}

// ─────────────────────────────────────────────
//  SETUP — Creates the monthly attendance sheet
// ─────────────────────────────────────────────
function setupSystem() {
  var now         = new Date();
  var year        = now.getFullYear();
  var month       = now.getMonth() + 1;
  var monthLabel  = getMonthLabel();
  var daysInMonth = getDaysInCurrentMonth();
  var holidays    = fetchHolidaysForMonth(year, month);

  var result          = buildColumnMap(year, month, daysInMonth, holidays);
  var colMap          = result.colMap;
  var summaryStartCol = result.summaryStartCol;
  var uniqueLabels    = result.uniqueLabels;
  var totalCols       = summaryStartCol - 1 + uniqueLabels.length * 2;

  var ssTitle = "Attendance Register - " + monthLabel;
  var ss      = SpreadsheetApp.create(ssTitle);
  var sheet   = ss.getSheets()[0];
  sheet.setName(SHEET_NAME);
  saveSpreadsheetId(ss.getId());

  PropertiesService.getScriptProperties().setProperty(
    "COL_MAP_" + year + "_" + month, JSON.stringify(colMap));
  PropertiesService.getScriptProperties().setProperty(
    "SUMMARY_START_COL_" + year + "_" + month, summaryStartCol.toString());
  PropertiesService.getScriptProperties().setProperty(
    "UNIQUE_LABELS_" + year + "_" + month, JSON.stringify(uniqueLabels));

  // ── Freeze rows & columns ──
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(2);

  // ── ROW 1: Month + Year title ──
  sheet.getRange(1, 1, 1, totalCols)
    .setValue("").setBackground("#1A237E");
  sheet.getRange(1, 1)
    .setValue("Attendance Register — " + monthLabel)
    .setFontColor("#FFFFFF").setFontSize(14).setFontWeight("bold")
    .setFontFamily("Arial").setHorizontalAlignment("left")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 42);

  // ── ROW 2: Lecture Time Slot header ──
  var row2Vals = ["Roll No", "Name", "Last Scan Time", "📱 Parent Phone", "🪪 PRN No", "🔑 Password"];
  colMap.forEach(function(c) {
    row2Vals.push(c.nonWorking ? "" : c.timeLabel);
  });
  for (var s = 0; s < uniqueLabels.length; s++) {
    row2Vals.push("✅ " + uniqueLabels[s]);
    row2Vals.push("❌ " + uniqueLabels[s]);
  }
  sheet.getRange(2, 1, 1, totalCols).setValues([row2Vals])
    .setBackground("#F9A825").setFontColor("#000000")
    .setFontSize(9).setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setFontFamily("Arial").setWrap(true)
    .setBorder(true,true,true,true,true,true,"#000000",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(2, 44);

  // ── ROW 3: Day + Date ──
  var row3Vals = ["", "", "", "", "", ""];
  colMap.forEach(function(c) {
    row3Vals.push(c.dayName + " " + c.date + (c.nonWorking ? "\n(" + c.nonWorkingLabel.substring(0,10) + ")" : "\n" + c.lectureLabel));
  });
  for (var s = 0; s < uniqueLabels.length * 2; s++) row3Vals.push("Monthly\nSummary");
  sheet.getRange(3, 1, 1, totalCols).setValues([row3Vals])
    .setBackground("#E3F2FD").setFontColor("#0D47A1")
    .setFontSize(8).setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setFontFamily("Arial").setWrap(true)
    .setBorder(true,true,true,true,true,true,"#90CAF9",SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(3, 50);

  // ── Column widths ──
  sheet.setColumnWidth(COL_ROLL,     85);
  sheet.setColumnWidth(COL_NAME,    160);
  sheet.setColumnWidth(COL_TIME,     82);
  sheet.setColumnWidth(COL_PHONE,   140);
  sheet.setColumnWidth(COL_PRN,     120);
  sheet.setColumnWidth(COL_PASSWORD, 110);
  colMap.forEach(function(c) { sheet.setColumnWidth(c.col, 52); });
  for (var s = 0; s < uniqueLabels.length * 2; s++) {
    sheet.setColumnWidth(summaryStartCol + s, 95);
  }

  // ── Style PRN and Password fixed header cells (rows 2 & 3) ──
  sheet.getRange(2, COL_PRN).setBackground("#00695C").setFontColor("#FFFFFF");
  sheet.getRange(3, COL_PRN).setBackground("#B2DFDB").setFontColor("#004D40");
  sheet.getRange(2, COL_PASSWORD).setBackground("#4A148C").setFontColor("#FFFFFF");
  sheet.getRange(3, COL_PASSWORD).setBackground("#E1BEE7").setFontColor("#4A148C");

  // ── Style each lecture column ──
  var cfRules = [];
  colMap.forEach(function(c) {
    if (c.nonWorking) {
      var isWeekend = (c.nonWorkingLabel === "Saturday" || c.nonWorkingLabel === "Sunday");
      var hBg  = isWeekend ? "#B0BEC5" : "#E65100";
      var hFg  = isWeekend ? "#263238" : "#FFFFFF";
      var dBg  = isWeekend ? "#ECEFF1" : "#FFF3E0";
      var dFg  = isWeekend ? "#78909C" : "#BF360C";
      var lbl  = isWeekend ? c.nonWorkingLabel.substring(0,3).toUpperCase() : c.nonWorkingLabel.substring(0,12);
      sheet.getRange(2, c.col).setBackground(hBg).setFontColor(hFg);
      sheet.getRange(3, c.col).setBackground(hBg).setFontColor(hFg);
      sheet.getRange(STUDENT_START_ROW, c.col, 60, 1)
        .setValue(lbl).setBackground(dBg).setFontColor(dFg)
        .setFontSize(8).setFontStyle("italic")
        .setHorizontalAlignment("center").setVerticalAlignment("middle")
        .clearDataValidations();
    } else {
      var isPrac = c.practical;
      sheet.getRange(2, c.col).setBackground(isPrac ? "#4527A0" : "#1565C0").setFontColor("#FFFFFF");
      sheet.getRange(3, c.col).setBackground(isPrac ? "#7E57C2" : "#42A5F5").setFontColor("#FFFFFF");

      for (var r = STUDENT_START_ROW; r <= STUDENT_START_ROW + 59; r++) {
        sheet.getRange(r, c.col).setBackground(r % 2 === 0 ? "#F5F5F5" : "#FFFFFF");
      }

      sheet.getRange(STUDENT_START_ROW, c.col, 60, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['P','A'], true)
          .setAllowInvalid(false)
          .setHelpText("P = Present, A = Absent").build()
      );

      var rng = sheet.getRange(STUDENT_START_ROW, c.col, 60, 1);
      cfRules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo("P").setBackground("#4CAF50").setFontColor("#FFFFFF").setBold(true)
        .setRanges([rng]).build());
      cfRules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo("A").setBackground("#F44336").setFontColor("#FFFFFF").setBold(true)
        .setRanges([rng]).build());
    }
  });
  sheet.setConditionalFormatRules(cfRules);

  // ── Summary column headers ──
  for (var s = 0; s < uniqueLabels.length; s++) {
    var pc = summaryStartCol + s * 2;
    var ac = summaryStartCol + s * 2 + 1;
    sheet.getRange(2, pc).setBackground("#2E7D32").setFontColor("#FFFFFF");
    sheet.getRange(2, ac).setBackground("#C62828").setFontColor("#FFFFFF");
    sheet.getRange(3, pc).setBackground("#A5D6A7").setFontColor("#1B5E20").setFontSize(8);
    sheet.getRange(3, ac).setBackground("#FFCDD2").setFontColor("#B71C1C").setFontSize(8);
  }

  // ── Student rows ──
  for (var r = STUDENT_START_ROW; r <= STUDENT_START_ROW + 59; r++) {
    sheet.setRowHeight(r, 27);

    sheet.getRange(r, COL_ROLL, 1, 6)
      .setHorizontalAlignment("center").setVerticalAlignment("middle")
      .setFontFamily("Arial").setFontSize(11)
      .setBorder(true,true,true,true,true,true,"#CCCCCC",SpreadsheetApp.BorderStyle.SOLID);

    var rowBg = r % 2 === 0 ? "#F0F4C3" : "#FFFDE7";
    sheet.getRange(r, COL_PRN).setBackground(rowBg);
    var rowBgPw = r % 2 === 0 ? "#F3E5F5" : "#FAF0FF";
    sheet.getRange(r, COL_PASSWORD).setBackground(rowBgPw);

    var summaries = buildSummaryFormulas(r, colMap, uniqueLabels, summaryStartCol);
    summaries.forEach(function(s2, idx) {
      var pc = summaryStartCol + idx * 2;
      var ac = summaryStartCol + idx * 2 + 1;
      sheet.getRange(r, pc)
        .setFormula(s2.presentFormula)
        .setBackground("#C8E6C9").setFontColor("#1B5E20").setFontWeight("bold")
        .setHorizontalAlignment("center").setVerticalAlignment("middle");
      sheet.getRange(r, ac)
        .setFormula(s2.absentFormula)
        .setBackground("#FFCDD2").setFontColor("#B71C1C").setFontWeight("bold")
        .setHorizontalAlignment("center").setVerticalAlignment("middle");
    });
  }

  Logger.log("✅ Timetable attendance sheet created: " + ssTitle);
  return ss.getUrl();
}

// ─────────────────────────────────────────────
//  doPost — Receive data from Arduino/ESP8266
// ─────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = getSheet();
    var parsedData;
    try { parsedData = JSON.parse(e.postData.contents); }
    catch(err) { parsedData = e.parameter; }

    if ((parsedData.command || "") === "check_connection") return sendResponse("Connected");
    if (!parsedData.values) return sendResponse("Error: Missing values");

    var parts        = parsedData.values.split(",");
    var rollNo       = (parts[0] || "").trim();
    var name         = (parts[1] || "").trim();
    var time         = (parts[2] || Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss")).trim();
    var dayNum       = parseInt((parts[3] || new Date().getDate()).toString().trim());
    var status       = (parts[4] || "P").trim().toUpperCase();
    if (status !== "P" && status !== "A") status = "P";
    var phone        = (parts[5] || "").trim();
    var prnNo        = (parts[6] || "").trim();
    var password     = (parts[7] || "").trim();
    var lectureIndex = (parts[8] !== undefined) ? parseInt((parts[8] || "0").trim()) : -1;

    var now      = new Date();
    var year     = now.getFullYear();
    var monthNum = now.getMonth() + 1;
    var scanDate = new Date(year, now.getMonth(), dayNum);
    var holidays = fetchHolidaysForMonth(year, monthNum);
    var nonWorkLabel = getNonWorkingLabel(scanDate, holidays);

    if (nonWorkLabel) {
      return sendResponse("Rejected: Today is " + nonWorkLabel + " — holiday/weekend.");
    }

    var colMapRaw = PropertiesService.getScriptProperties()
      .getProperty("COL_MAP_" + year + "_" + monthNum);
    if (!colMapRaw) return sendResponse("Error: Sheet not set up. Run setupSystem() first.");
    var colMap = JSON.parse(colMapRaw);

    var targetColEntry = null;
    colMap.forEach(function(c) {
      if (c.date === dayNum && !c.nonWorking && c.lectureIdx === lectureIndex) {
        targetColEntry = c;
      }
    });

    if (!targetColEntry) {
      var timeParts = time.split(":");
      var scanMins  = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
      var dow       = scanDate.getDay();
      colMap.forEach(function(c) {
        if (c.date === dayNum && !c.nonWorking && targetColEntry === null) {
          var slot = TIMETABLE[dow] ? TIMETABLE[dow][c.lectureIdx] : null;
          if (slot) {
            var slotStart = slot.startHour * 60 + slot.startMin;
            var slotEnd   = slot.endHour   * 60 + slot.endMin;
            if (scanMins >= slotStart && scanMins < slotEnd) targetColEntry = c;
          }
        }
      });
      if (!targetColEntry) {
        var dayEntries = colMap.filter(function(c) { return c.date === dayNum && !c.nonWorking; });
        if (dayEntries.length > 0) targetColEntry = dayEntries[0];
      }
    }

    if (!targetColEntry) return sendResponse("Error: No lecture column for Day " + dayNum + " Index " + lectureIndex);

    var dateCol = targetColEntry.col;
    var foundRow = -1;
    for (var r = STUDENT_START_ROW; r <= STUDENT_START_ROW + 59; r++) {
      var cellVal = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
      if (cellVal === rollNo) { foundRow = r; break; }
    }

    if (foundRow === -1) {
      for (var r = STUDENT_START_ROW; r <= STUDENT_START_ROW + 59; r++) {
        var cellVal = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
        if (cellVal === "") { foundRow = r; break; }
      }
      if (foundRow === -1) return sendResponse("Error: All 60 slots are full.");

      var summaryStartCol = parseInt(PropertiesService.getScriptProperties()
        .getProperty("SUMMARY_START_COL_" + year + "_" + monthNum) || "7");
      var uniqueLabels = JSON.parse(PropertiesService.getScriptProperties()
        .getProperty("UNIQUE_LABELS_" + year + "_" + monthNum) || "[]");

      sheet.setRowHeight(foundRow, 27);
      sheet.getRange(foundRow, COL_ROLL, 1, 6)
        .setHorizontalAlignment("center").setVerticalAlignment("middle")
        .setFontFamily("Arial").setFontSize(11)
        .setBorder(true,true,true,true,true,true,"#CCCCCC",SpreadsheetApp.BorderStyle.SOLID);

      var summaries = buildSummaryFormulas(foundRow, colMap, uniqueLabels, summaryStartCol);
      summaries.forEach(function(s, idx) {
        var pc = summaryStartCol + idx * 2;
        var ac = summaryStartCol + idx * 2 + 1;
        sheet.getRange(foundRow, pc).setFormula(s.presentFormula)
          .setBackground("#C8E6C9").setFontColor("#1B5E20").setFontWeight("bold").setHorizontalAlignment("center");
        sheet.getRange(foundRow, ac).setFormula(s.absentFormula)
          .setBackground("#FFCDD2").setFontColor("#B71C1C").setFontWeight("bold").setHorizontalAlignment("center");
      });
    }

    sheet.getRange(foundRow, COL_ROLL).setValue(rollNo);
    sheet.getRange(foundRow, COL_NAME).setValue(name);
    sheet.getRange(foundRow, COL_TIME).setValue(time);
    sheet.getRange(foundRow, dateCol).setValue(status);
    if (phone)    sheet.getRange(foundRow, COL_PHONE).setValue(phone);
    if (prnNo)    sheet.getRange(foundRow, COL_PRN).setValue(prnNo);
    if (password) sheet.getRange(foundRow, COL_PASSWORD).setValue(password);

    return sendResponse("Success: " + rollNo + " marked " + status + " for " + targetColEntry.lectureLabel + " on Day " + dayNum);

  } catch(error) {
    return sendResponse("Error: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
//  ⏰ AUTOMATIC LECTURE-END Absent Triggers
// ─────────────────────────────────────────────
function setupAllLectureTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "markAbsentForEndedLecture" || fn === "send5PMAbsentSMS") {
      ScriptApp.deleteTrigger(t);
    }
  });

  var endTimes = {};
  for (var dow in TIMETABLE) {
    TIMETABLE[dow].forEach(function(slot) {
      var key = slot.endHour + ":" + slot.endMin;
      endTimes[key] = { endHour: slot.endHour, endMin: slot.endMin };
    });
  }

  var hoursSet = {};
  for (var key in endTimes) {
    var h = endTimes[key].endHour;
    if (!hoursSet[h]) {
      hoursSet[h] = true;
      ScriptApp.newTrigger("markAbsentForEndedLecture")
        .timeBased().everyDays(1).atHour(h).inTimezone(TIMEZONE).create();
    }
  }

  ScriptApp.newTrigger("send5PMAbsentSMS")
    .timeBased().everyDays(1).atHour(17).inTimezone(TIMEZONE).create();

  Logger.log("✅ Triggers created.");
}

function markAbsentForEndedLecture() {
  var now      = new Date();
  var year     = now.getFullYear();
  var monthNum = now.getMonth() + 1;
  var dayNum   = now.getDate();
  var curHour  = now.getHours();

  var holidays     = fetchHolidaysForMonth(year, monthNum);
  var nonWorkLabel = getNonWorkingLabel(now, holidays);
  if (nonWorkLabel) { Logger.log("Skipping holiday"); return; }

  var dow   = now.getDay();
  var slots = TIMETABLE[dow] || [];
  if (slots.length === 0) return;

  var colMapRaw = PropertiesService.getScriptProperties().getProperty("COL_MAP_" + year + "_" + monthNum);
  if (!colMapRaw) return;
  var colMap = JSON.parse(colMapRaw);

  var sheet = getSheet();
  var justEndedCols = colMap.filter(function(c) {
    if (c.date !== dayNum || c.nonWorking) return false;
    var slot = TIMETABLE[dow] ? TIMETABLE[dow][c.lectureIdx] : null;
    return slot && slot.endHour === curHour;
  });

  var lastRow = sheet.getLastRow();
  justEndedCols.forEach(function(c) {
    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      var rollNo = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
      if (!rollNo) continue;
      var current = sheet.getRange(r, c.col).getValue().toString().trim();
      if (current === "") {
        sheet.getRange(r, c.col).setValue("A");
      }
    }
  });
}

function send5PMAbsentSMS() {
  var now      = new Date();
  var year     = now.getFullYear();
  var monthNum = now.getMonth() + 1;
  var dayNum   = now.getDate();

  var holidays     = fetchHolidaysForMonth(year, monthNum);
  var nonWorkLabel = getNonWorkingLabel(now, holidays);
  if (nonWorkLabel) return;

  var colMapRaw = PropertiesService.getScriptProperties().getProperty("COL_MAP_" + year + "_" + monthNum);
  if (!colMapRaw) return;
  var colMap = JSON.parse(colMapRaw);

  var todayCols = colMap.filter(function(c) { return c.date === dayNum && !c.nonWorking; });
  if (todayCols.length === 0) return;

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
    var rollNo = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
    if (!rollNo) continue;
    var name  = sheet.getRange(r, COL_NAME).getValue().toString().trim();
    var phone = sheet.getRange(r, COL_PHONE).getValue().toString().trim();

    var absentLectures = [];
    todayCols.forEach(function(c) {
      var val = sheet.getRange(r, c.col).getValue().toString().trim();
      if (val === "A") absentLectures.push(c.lectureLabel + " (" + c.timeLabel + ")");
    });

    if (absentLectures.length === 0) continue;

    if (phone && phone.length === 10) {
      sendAbsentSMSDetailed(name, phone, absentLectures);
      Utilities.sleep(500);
    }
  }
}

function sendAbsentSMSDetailed(studentName, parentPhone, absentLectures) {
  try {
    var today   = Utilities.formatDate(new Date(), TIMEZONE, "dd-MM-yyyy");
    var lectStr = absentLectures.join(", ");
    var message = "Dear Parent, your ward " + studentName +
                  " was ABSENT from the following lectures today (" + today + "): " +
                  lectStr + ". Please contact the college if needed. - Attendance System";
    if (message.length > 320) message = message.substring(0, 317) + "...";

    UrlFetchApp.fetch("https://www.fast2sms.com/dev/bulkV2", {
      method     : "POST",
      contentType: "application/json",
      headers    : { "authorization": FAST2SMS_API_KEY },
      payload    : JSON.stringify({
        route: "q", message: message,
        numbers: parentPhone, flash: "0", language: "english"
      }),
      muteHttpExceptions: true
    });
  } catch(err) {
    Logger.log("SMS error: " + err);
  }
}

function testSMS() {
  sendAbsentSMSDetailed("Test Student", "9767806125", ["DCOM(MDP) (10:00-11:00)"]);
}

function refreshHolidays() {
  var now      = new Date();
  var year     = now.getFullYear();
  var monthNum = now.getMonth() + 1;
  PropertiesService.getScriptProperties().deleteProperty("HOL_" + year + "_" + monthNum);
  fetchHolidaysForMonth(year, monthNum);
}

// ─────────────────────────────────────────────
//  ✏️ Manual Attendance Entry
// ─────────────────────────────────────────────
function markManual() {
  var ui   = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    "Manual Attendance Entry",
    "Format: RollNo, Name, PRN No, Password, DayNumber, LectureIndex, P or A\n" +
    "Example: 101, John Doe, PRN2024001, pass123, 25, 2, P",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var parts = resp.getResponseText().split(",");
  if (parts.length < 7) { ui.alert("Invalid format."); return; }

  var rollNo   = parts[0].trim();
  var name     = parts[1].trim();
  var prnNo    = parts[2].trim();
  var password = parts[3].trim();
  var dayNum   = parseInt(parts[4].trim());
  var lecIdx   = parseInt(parts[5].trim());
  var status   = parts[6].trim().toUpperCase();

  var now      = new Date();
  var year     = now.getFullYear();
  var monthNum = now.getMonth() + 1;
  var colMapRaw = PropertiesService.getScriptProperties().getProperty("COL_MAP_" + year + "_" + monthNum);
  if (!colMapRaw) return;
  var colMap = JSON.parse(colMapRaw);

  var entry = null;
  colMap.forEach(function(c) {
    if (c.date === dayNum && !c.nonWorking && c.lectureIdx === lecIdx) entry = c;
  });
  if (!entry) return;

  var sheet    = getSheet();
  var lastRow  = sheet.getLastRow();
  var foundRow = -1;
  for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
    if (sheet.getRange(r, COL_ROLL).getValue().toString().trim() === rollNo) { foundRow = r; break; }
  }
  if (foundRow === -1) {
    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      if (sheet.getRange(r, COL_ROLL).getValue().toString().trim() === "") { foundRow = r; break; }
    }
  }
  if (foundRow === -1) {
    foundRow = lastRow + 1;
  }

  sheet.getRange(foundRow, COL_ROLL).setValue(rollNo);
  sheet.getRange(foundRow, COL_NAME).setValue(name);
  sheet.getRange(foundRow, COL_TIME).setValue(Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss"));
  sheet.getRange(foundRow, COL_PRN).setValue(prnNo);
  sheet.getRange(foundRow, COL_PASSWORD).setValue(password);
  sheet.getRange(foundRow, entry.col).setValue(status);
}

function newMonthSheet() { setupSystem(); }

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📋 Attendance")
    .addItem("🆕 Create New Timetable Attendance Sheet",    "setupSystem")
    .addSeparator()
    .addItem("✏️  Mark Attendance Manually (Lecture-Aware)", "markManual")
    .addSeparator()
    .addItem("⏰ Setup Lecture-End + 5PM SMS Triggers",     "setupAllLectureTriggers")
    .addItem("🚨 Run Lecture-End Absent Check Now",         "markAbsentForEndedLecture")
    .addItem("📱 Run 5PM SMS Check Now (Test)",             "send5PMAbsentSMS")
    .addSeparator()
    .addItem("🔄 Refresh Holidays from Internet",           "refreshHolidays")
    .addSeparator()
    .addItem("📱 Test SMS (Fast2SMS)",                      "testSMS")
    .addSeparator()
    .addItem("📅 New Month Sheet",                          "newMonthSheet")
    .addToUi();
}

function sendResponse(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

// ─────────────────────────────────────────────
//  doGet — Student and Admin Web APIs
// ─────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action || "";

  // ── 1. GET ALL STUDENTS & FULL DETAILS (Admin & Global View) ──
  if (action === "getStudents") {
    var sheet    = getSheet();
    var now      = new Date();
    var year     = now.getFullYear();
    var monthNum = now.getMonth() + 1;

    var colMapRaw = PropertiesService.getScriptProperties().getProperty("COL_MAP_" + year + "_" + monthNum);
    var uniqueLabelsRaw = PropertiesService.getScriptProperties().getProperty("UNIQUE_LABELS_" + year + "_" + monthNum);
    var summaryStartCol = parseInt(PropertiesService.getScriptProperties().getProperty("SUMMARY_START_COL_" + year + "_" + monthNum) || "7");

    if (!colMapRaw) return sendJsonResponse({ error: "Sheet not set up" });

    var colMap       = JSON.parse(colMapRaw);
    var uniqueLabels = JSON.parse(uniqueLabelsRaw || "[]");
    
    // Read all values in one optimized call
    var values = sheet.getDataRange().getValues();
    var students = [];
    var lastRow = values.length;

    // Load custom photos mapping if exists
    var photosMap = {};
    try {
      var pSheet = getPhotosSheet();
      var pVals = pSheet.getDataRange().getValues();
      for (var i = 1; i < pVals.length; i++) {
        var rNo = pVals[i][0].toString().trim();
        photosMap[rNo] = pVals[i][1];
      }
    } catch(err) { Logger.log("Error loading photos lookup sheet: " + err); }

    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      var rowVals = values[r - 1];
      if (!rowVals) continue;
      var roll = (rowVals[COL_ROLL - 1] || "").toString().trim();
      if (!roll) continue;

      var student = {
        roll:     roll,
        name:     rowVals[COL_NAME - 1],
        phone:    rowVals[COL_PHONE - 1],
        prn:      rowVals[COL_PRN - 1],
        lastScan: rowVals[COL_TIME - 1] ? rowVals[COL_TIME - 1].toString() : "",
        password: rowVals[COL_PASSWORD - 1],
        photo:    photosMap[roll] || "", // Merge photo from worksheet
        summary:  {},
        attendance: {}
      };

      // Extract subject summaries
      uniqueLabels.forEach(function(lbl, idx) {
        var pc = summaryStartCol + idx * 2;
        var ac = summaryStartCol + idx * 2 + 1;
        student.summary[lbl] = {
          present: rowVals[pc - 1] || 0,
          absent:  rowVals[ac - 1] || 0
        };
      });

      // Extract raw calendar grid values
      colMap.forEach(function(c) {
        if (!c.nonWorking) {
          student.attendance[c.col] = rowVals[c.col - 1] || "-";
        } else {
          student.attendance[c.col] = "SUN";
        }
      });

      // Today's lectures quick preview
      var today = now.getDate();
      var todayCols = colMap.filter(function(c) { return c.date === today && !c.nonWorking; });
      student.todayLectures = todayCols.map(function(c) {
        return {
          label:  c.lectureLabel,
          time:   c.timeLabel,
          status: rowVals[c.col - 1] || "-"
        };
      });

      students.push(student);
    }

    return sendJsonResponse({ 
      students: students, 
      month: getMonthLabel(),
      colMap: colMap,
      uniqueLabels: uniqueLabels,
      summaryStartCol: summaryStartCol
    });
  }

  // ── 2. STUDENT LOGIN (Check Roll No/PRN + Password) ──
  if (action === "studentLogin") {
    var roll = (e.parameter.roll || "").trim();
    var pass = (e.parameter.password || "").trim();
    var sheet = getSheet();

    var values = sheet.getDataRange().getValues();
    var lastRow = values.length;
    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      var rowVals = values[r - 1];
      if (!rowVals) continue;
      var cellRoll = (rowVals[COL_ROLL - 1] || "").toString().trim();
      var cellPrn = (rowVals[COL_PRN - 1] || "").toString().trim();
      var cellPass = (rowVals[COL_PASSWORD - 1] || "").toString().trim();
      
      if (cellRoll === roll && cellPass === pass) {
        var now          = new Date();
        var year         = now.getFullYear();
        var monthNum     = now.getMonth() + 1;
        
        var summaryStart = parseInt(PropertiesService.getScriptProperties().getProperty("SUMMARY_START_COL_" + year + "_" + monthNum) || "7");
        var uniqueLabels = JSON.parse(PropertiesService.getScriptProperties().getProperty("UNIQUE_LABELS_" + year + "_" + monthNum) || "[]");
        var colMap = JSON.parse(PropertiesService.getScriptProperties().getProperty("COL_MAP_" + year + "_" + monthNum) || "[]");

        var summary = {};
        uniqueLabels.forEach(function(lbl, idx) {
          summary[lbl] = {
            present: rowVals[summaryStart + idx * 2 - 1] || 0,
            absent:  rowVals[summaryStart + idx * 2] || 0
          };
        });

        var attendance = {};
        colMap.forEach(function(c) {
          if (!c.nonWorking) {
            attendance[c.col] = rowVals[c.col - 1] || "-";
          } else {
            attendance[c.col] = "SUN";
          }
        });

        var photoFromSheet = getStudentPhoto(cellRoll);

        return sendJsonResponse({
          success:  true,
          roll:     cellRoll,
          name:     rowVals[COL_NAME - 1],
          phone:    rowVals[COL_PHONE - 1],
          prn:      rowVals[COL_PRN - 1],
          lastScan: rowVals[COL_TIME - 1] ? rowVals[COL_TIME - 1].toString() : "",
          summary:  summary,
          attendance: attendance,
          month:    getMonthLabel(),
          photo:    photoFromSheet || "",
          colMap:   colMap
        });
      }
    }
    return sendJsonResponse({ success: false, error: "Invalid Roll No or Password" });
  }

  // ── 3. UPDATE STUDENT PROFILE (Admin or Student) ──
  if (action === "updateStudent") {
    var roll = (e.parameter.roll || "").trim();
    var name = e.parameter.name;
    var phone = e.parameter.phone;
    var prn = e.parameter.prn;
    var password = e.parameter.password;
    var photo = e.parameter.photo;
    
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      var cellRoll = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
      if (cellRoll === roll) {
        if (name !== undefined) sheet.getRange(r, COL_NAME).setValue(name);
        if (phone !== undefined) sheet.getRange(r, COL_PHONE).setValue(phone);
        if (prn !== undefined) sheet.getRange(r, COL_PRN).setValue(prn);
        if (password !== undefined) sheet.getRange(r, COL_PASSWORD).setValue(password);
        if (photo !== undefined && photo !== null && photo !== "") {
          setStudentPhoto(roll, photo);
        }
        
        return sendJsonResponse({ success: true, message: "Student profile updated successfully" });
      }
    }
    return sendJsonResponse({ success: false, error: "Student roll number not found" });
  }

  // ── 4. UPDATE ATTENDANCE CELL VALUE (Admin Class Register) ──
  if (action === "updateAttendance") {
    var roll = (e.parameter.roll || "").trim();
    var colNum = parseInt(e.parameter.col || "-1");
    var status = (e.parameter.status || "").trim().toUpperCase(); // 'P', 'A', or '-'
    if (status === "-") status = ""; // blank cell in sheet represents unmarked

    if (colNum === -1) return sendJsonResponse({ success: false, error: "Invalid column number" });

    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
      var cellRoll = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
      if (cellRoll === roll) {
        sheet.getRange(r, colNum).setValue(status);
        return sendJsonResponse({ success: true, message: "Attendance marked successfully" });
      }
    }
    return sendJsonResponse({ success: false, error: "Student roll number not found" });
  }

  return sendJsonResponse({ error: "Unknown action" });
}

// ─────────────────────────────────────────────
//  doPost — Handle JSON payload updates (CORS friendly)
// ─────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
    
    var action = postData.action || "";
    
    if (action === "updateStudent") {
      var roll = (postData.roll || "").toString().trim();
      var name = postData.name;
      var phone = postData.phone;
      var prn = postData.prn;
      var password = postData.password;
      var photo = postData.photo; // Base64 string
      
      var sheet = getSheet();
      var lastRow = sheet.getLastRow();
      
      for (var r = STUDENT_START_ROW; r <= lastRow; r++) {
        var cellRoll = sheet.getRange(r, COL_ROLL).getValue().toString().trim();
        if (cellRoll === roll) {
          if (name !== undefined) sheet.getRange(r, COL_NAME).setValue(name);
          if (phone !== undefined) sheet.getRange(r, COL_PHONE).setValue(phone);
          if (prn !== undefined) sheet.getRange(r, COL_PRN).setValue(prn);
          if (password !== undefined) sheet.getRange(r, COL_PASSWORD).setValue(password);
          
          if (photo !== undefined && photo !== null) {
            setStudentPhoto(roll, photo);
          }
          
          return sendJsonResponse({ success: true, message: "Student profile updated successfully" });
        }
      }
      return sendJsonResponse({ success: false, error: "Student roll number not found" });
    }
    
    return sendJsonResponse({ success: false, error: "Unknown POST action: " + action });
  } catch(error) {
    return sendJsonResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
//  Photos Sheets integration helper functions
// ─────────────────────────────────────────────
function getPhotosSheet() {
  var sheet = getSheet();
  var ss = sheet.getParent();
  var photosSheet = ss.getSheetByName("Photos");
  if (!photosSheet) {
    photosSheet = ss.insertSheet("Photos");
    photosSheet.appendRow(["Roll No", "Photo Data"]);
    photosSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  return photosSheet;
}

function getStudentPhoto(roll) {
  try {
    var sheet = getPhotosSheet();
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][0].toString().trim() === roll.toString().trim()) {
        return values[i][1] || "";
      }
    }
  } catch(e) {
    Logger.log("Error getStudentPhoto: " + e);
  }
  return "";
}

function setStudentPhoto(roll, photoData) {
  try {
    var sheet = getPhotosSheet();
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][0].toString().trim() === roll.toString().trim()) {
        sheet.getRange(i + 1, 2).setValue(photoData);
        return;
      }
    }
    sheet.appendRow([roll.toString(), photoData]);
  } catch(e) {
    Logger.log("Error setStudentPhoto: " + e);
  }
}

function sendJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
