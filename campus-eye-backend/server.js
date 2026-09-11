// ============================================
// CampusEye Backend - SQLite-backed Express Server
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const db = new sqlite3.Database(path.join(__dirname, 'campus-eye.db'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function initializeDatabase() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      rollNumber TEXT NOT NULL,
      department TEXT NOT NULL,
      year TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Student', 'Admin'))
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      studentId INTEGER NOT NULL,
      studentName TEXT NOT NULL,
      date TEXT NOT NULL,
      image TEXT,
      FOREIGN KEY(studentId) REFERENCES users(id)
    )
  `);

  const adminExists = await getQuery('SELECT id FROM users WHERE email = ?', ['admin@college.edu']);
  if (!adminExists) {
    await runQuery(
      `INSERT INTO users (fullName, email, rollNumber, department, year, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Admin User', 'admin@college.edu', 'ADMIN001', 'Administration', 'N/A', 'admin123', 'Admin']
    );
  }
}

async function findUserByEmail(email) {
  return getQuery('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
}

async function findUserById(id) {
  return getQuery('SELECT * FROM users WHERE id = ?', [id]);
}

async function getComplaintsByStudent(studentId) {
  return allQuery('SELECT * FROM complaints WHERE studentId = ? ORDER BY id DESC', [studentId]);
}

async function getAllComplaints() {
  return allQuery('SELECT * FROM complaints ORDER BY id DESC');
}

async function getComplaintCounts(studentId = null) {
  const list = studentId ? await getComplaintsByStudent(studentId) : await getAllComplaints();
  return {
    total: list.length,
    pending: list.filter(c => c.status === 'pending').length,
    inProgress: list.filter(c => c.status === 'in progress').length,
    resolved: list.filter(c => c.status === 'resolved').length
  };
}

// ============================================
// AUTH ROUTES
// ============================================

// POST /api/register - Register a new student
app.post('/api/register', async (req, res) => {
  const { fullName, email, rollNumber, department, year, password } = req.body;

  if (!fullName || !email || !rollNumber || !department || !year || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const result = await runQuery(
    `INSERT INTO users (fullName, email, rollNumber, department, year, password, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fullName, email, rollNumber, department, year, password, 'Student']
  );

  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      id: result.id,
      fullName,
      email,
      role: 'Student'
    }
  });
});

// POST /api/login - Login user
app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  if (user.password !== password) {
    return res.status(401).json({ success: false, message: 'Wrong password' });
  }

  if (role && user.role !== role) {
    return res.status(401).json({ success: false, message: 'Role mismatch' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      year: user.year,
      rollNumber: user.rollNumber
    }
  });
});

// ============================================
// COMPLAINT ROUTES
// ============================================

// POST /api/complaints - Submit a new complaint
app.post('/api/complaints', async (req, res) => {
  const { title, category, location, description, priority, studentId } = req.body;

  if (!title || !category || !location || !description || !priority || !studentId) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const student = await findUserById(Number(studentId));
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const complaintDate = new Date().toISOString().split('T')[0];
  const result = await runQuery(
    `INSERT INTO complaints (title, category, location, description, priority, status, studentId, studentName, date, image)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL)`,
    [title, category, location, description, priority, Number(studentId), student.fullName, complaintDate]
  );

  const newComplaint = {
    id: result.id,
    title,
    category,
    location,
    description,
    priority,
    status: 'pending',
    studentId: Number(studentId),
    studentName: student.fullName,
    date: complaintDate,
    image: null
  };

  res.json({
    success: true,
    message: 'Complaint submitted successfully',
    complaint: newComplaint
  });
});

// GET /api/complaints/student/:studentId
app.get('/api/complaints/student/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const studentComplaints = await getComplaintsByStudent(studentId);

  res.json({
    success: true,
    complaints: studentComplaints
  });
});

// GET /api/complaints - Get all complaints (Admin)
app.get('/api/complaints', async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM complaints';
  const params = [];

  if (status && status !== 'all') {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  if (search) {
    const term = `%${String(search).toLowerCase()}%`;
    if (params.length > 0) {
      sql += ' AND (LOWER(studentName) LIKE ? OR LOWER(title) LIKE ?)';
    } else {
      sql += ' WHERE (LOWER(studentName) LIKE ? OR LOWER(title) LIKE ?)';
    }
    params.push(term, term);
  }

  sql += ' ORDER BY id DESC';

  const result = await allQuery(sql, params);
  res.json({ success: true, complaints: result });
});

// PUT /api/complaints/:id/status - Update status
app.put('/api/complaints/:id/status', async (req, res) => {
  const complaintId = Number(req.params.id);
  const { status } = req.body;

  const validStatuses = ['pending', 'in progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const complaint = await getQuery('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  if (!complaint) {
    return res.status(404).json({ success: false, message: 'Complaint not found' });
  }

  await runQuery('UPDATE complaints SET status = ? WHERE id = ?', [status, complaintId]);

  const updatedComplaint = await getQuery('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  res.json({ success: true, message: 'Status updated', complaint: updatedComplaint });
});

// ============================================
// DASHBOARD STATS
// ============================================

// GET /api/dashboard/student/:studentId
app.get('/api/dashboard/student/:studentId', async (req, res) => {
  const stats = await getComplaintCounts(Number(req.params.studentId));
  res.json({ success: true, stats });
});

// GET /api/dashboard/admin
app.get('/api/dashboard/admin', async (req, res) => {
  const stats = await getComplaintCounts();
  res.json({ success: true, stats });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log('============================================');
      console.log('  CampusEye Backend is running!');
      console.log('  URL: http://localhost:' + PORT);
      console.log('============================================');
      console.log('');
      console.log('Demo Admin Login:');
      console.log('  Email: admin@college.edu');
      console.log('  Password: admin123');
      console.log('  Role: Admin');
      console.log('');
      console.log('API Endpoints:');
      console.log('  POST /api/register');
      console.log('  POST /api/login');
      console.log('  POST /api/complaints');
      console.log('  GET  /api/complaints/student/:id');
      console.log('  GET  /api/complaints');
      console.log('  PUT  /api/complaints/:id/status');
      console.log('  GET  /api/dashboard/student/:id');
      console.log('  GET  /api/dashboard/admin');
      console.log('============================================');
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

startServer();