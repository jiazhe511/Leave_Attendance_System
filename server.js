const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

const LEAVE_FILE = path.join(__dirname, 'leaves.json');
const ATTENDANCE_FILE = path.join(__dirname, 'attendance.json');

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
  }
}));

// 讀取請假資料
let leaveRecords = {};
try {
  if (fs.existsSync(LEAVE_FILE)) {
    leaveRecords = JSON.parse(fs.readFileSync(LEAVE_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('讀取請假檔案錯誤:', e);
}

// 讀取點名資料
let attendanceRecords = {};
try {
  if (fs.existsSync(ATTENDANCE_FILE)) {
    attendanceRecords = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('讀取點名檔案錯誤:', e);
}

// 寫入請假資料
function saveLeaveData() {
  try {
    fs.writeFileSync(LEAVE_FILE, JSON.stringify(leaveRecords, null, 2), 'utf-8');
  } catch (e) {
    console.error('寫入請假檔案錯誤:', e);
  }
}

// 寫入點名資料
function saveAttendanceData() {
  try {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendanceRecords, null, 2), 'utf-8');
  } catch (e) {
    console.error('寫入點名檔案錯誤:', e);
  }
}

// 登入 API
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin1' && password === 'KARATEDO') {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  else if(username === 'admin2' && password === 'karatedo') {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
});

// 登出 API
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// 權限檢查中介函式
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(403).json({ message: '未授權' });
}

// 請假系統 API
app.post('/submit', (req, res) => {
  const { name, region, date, reason } = req.body;
  if (!name || !region || !date || !reason) {
    return res.status(400).json({ message: '欄位不足' });
  }
  if (!leaveRecords[name]) leaveRecords[name] = [];
  leaveRecords[name].push({ region, date, reason });
  saveLeaveData();
  res.json({ message: '請假申請已收到' });
});

// 取得請假資料
app.get('/records', requireAdmin, (req, res) => {
  res.json(leaveRecords);
});

// 刪除請假紀錄
app.post('/delete', requireAdmin, (req, res) => {
  const { name, index } = req.body;
  if (!leaveRecords[name] || !leaveRecords[name][index]) {
    return res.status(400).json({ message: '找不到該筆資料' });
  }
  leaveRecords[name].splice(index, 1);
  saveLeaveData();
  res.json({ message: '刪除成功' });
});

// 編輯請假紀錄
app.post('/edit', requireAdmin, (req, res) => {
  const { name, index, newRecord } = req.body;
  if (!leaveRecords[name] || !leaveRecords[name][index]) {
    return res.status(400).json({ message: '找不到該筆資料' });
  }
  leaveRecords[name][index] = newRecord;
  saveLeaveData();
  res.json({ message: '編輯成功' });
});

// 取得所有學生列表（依區域）
app.get('/students', requireAdmin, (req, res) => {
  // attendanceRecords 結構：{ region: { studentName: {dates:[]} } }
  const students = {};
  for (const region in attendanceRecords) {
    students[region] = Object.keys(attendanceRecords[region] || {});
  }
  res.json(students);
});

// 取得點名資料
app.get('/attendance', requireAdmin, (req, res) => {
  res.json(attendanceRecords);
});

// 儲存點名資料
app.post('/attendance', requireAdmin, (req, res) => {
  const { region, attendanceRecords: newRecords } = req.body;
  if (!region || !newRecords) {
    return res.status(400).json({ message: '缺少區域或點名資料' });
  }
  attendanceRecords[region] = newRecords;
  saveAttendanceData();
  res.json({ message: '點名資料已儲存' });
});

// 新增學生
app.post('/students/add', requireAdmin, (req, res) => {
  const { region, studentName } = req.body;
  if (!region || !studentName) {
    return res.status(400).json({ message: '缺少區域或學生姓名' });
  }
  if (!attendanceRecords[region]) attendanceRecords[region] = {};
  if (attendanceRecords[region][studentName]) {
    return res.status(400).json({ message: '學生已存在該區域' });
  }
  attendanceRecords[region][studentName] = { dates: [] };
  saveAttendanceData();
  res.json({ message: '新增成功' });
});

// 刪除學生
app.post('/students/delete', requireAdmin, (req, res) => {
  const { region, studentName } = req.body;
  if (!region || !studentName) {
    return res.status(400).json({ message: '缺少區域或學生姓名' });
  }
  if (attendanceRecords[region] && attendanceRecords[region][studentName]) {
    delete attendanceRecords[region][studentName];
    saveAttendanceData();
    res.json({ message: '刪除成功' });
  } else {
    res.status(404).json({ message: '找不到學生資料' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
