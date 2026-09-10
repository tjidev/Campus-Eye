// ============================================
// CampusEye Backend - Simple Express Server
// For local use only (in-memory storage)
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files

// ============================================
// IN-MEMORY DATABASE (resets on restart)
// ============================================
let users = [];
let complaints = [];
let nextUserId = 1;
let nextComplaintId = 1;

// Pre-load a demo admin
users.push({
  id: 0,
  fullName: 'Admin User',
  email: 'admin@college.edu',
  rollNumber: 'ADMIN001',
  department: 'Administration',
  year: 'N/A',
  password: 'admin123',
  role: 'Admin'
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function findUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  return users.find(u => u.id === id);
}

function getComplaintsByStudent(studentId) {
  return complaints.filter(c => c.studentId === studentId);
}

function getComplaintCounts(studentId = null) {
  const list = studentId ? getComplaintsByStudent(studentId) : complaints;
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
app.post('/api/register', (req, res) => {
  const { fullName, email, rollNumber, department, year, password } = req.body;

  if (!fullName || !email || !rollNumber || !department || !year || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (findUserByEmail(email)) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const newUser = {
    id: nextUserId++,
    fullName,
    email,
    rollNumber,
    department,
    year,
    password,
    role: 'Student'
  };

  users.push(newUser);

  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// POST /api/login - Login user
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = findUserByEmail(email);

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
app.post('/api/complaints', (req, res) => {
  const { title, category, location, description, priority, studentId } = req.body;

  if (!title || !category || !location || !description || !priority || !studentId) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const student = findUserById(Number(studentId));
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const newComplaint = {
    id: nextComplaintId++,
    title,
    category,
    location,
    description,
    priority,
    status: 'pending',
    studentId: Number(studentId),
    studentName: student.fullName,
    date: new Date().toISOString().split('T')[0],
    image: null
  };

  complaints.push(newComplaint);

  res.json({
    success: true,
    message: 'Complaint submitted successfully',
    complaint: newComplaint
  });
});

// GET /api/complaints/student/:studentId
app.get('/api/complaints/student/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);
  const studentComplaints = getComplaintsByStudent(studentId);

  res.json({
    success: true,
    complaints: studentComplaints
  });
});

// GET /api/complaints - Get all complaints (Admin)
app.get('/api/complaints', (req, res) => {
  const { status, search } = req.query;
  let result = [...complaints];

  if (status && status !== 'all') {
    result = result.filter(c => c.status === status);
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(c =>
      c.studentName.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term)
    );
  }

  res.json({ success: true, complaints: result });
});

// PUT /api/complaints/:id/status - Update status
app.put('/api/complaints/:id/status', (req, res) => {
  const complaintId = Number(req.params.id);
  const { status } = req.body;

  const validStatuses = ['pending', 'in progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const complaint = complaints.find(c => c.id === complaintId);
  if (!complaint) {
    return res.status(404).json({ success: false, message: 'Complaint not found' });
  }

  complaint.status = status;

  res.json({ success: true, message: 'Status updated', complaint });
});

// ============================================
// DASHBOARD STATS
// ============================================

// GET /api/dashboard/student/:studentId
app.get('/api/dashboard/student/:studentId', (req, res) => {
  const stats = getComplaintCounts(Number(req.params.studentId));
  res.json({ success: true, stats });
});

// GET /api/dashboard/admin
app.get('/api/dashboard/admin', (req, res) => {
  const stats = getComplaintCounts();
  res.json({ success: true, stats });
});

// ============================================
// START SERVER
// ============================================

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