// ============================================
// CampusEye Frontend API Connector
// ============================================

const API_BASE = 'http://localhost:3000/api';

async function apiCall(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(API_BASE + url, options);
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

function saveUser(user) {
  localStorage.setItem('campusEyeUser', JSON.stringify(user));
}

function getUser() {
  const data = localStorage.getItem('campusEyeUser');
  return data ? JSON.parse(data) : null;
}

function logout() {
  localStorage.removeItem('campusEyeUser');
  window.location.href = 'login_page.html';
}

function requireAuth() {
  if (!getUser()) window.location.href = 'login_page.html';
}

function requireRole(role) {
  const user = getUser();
  if (!user || user.role !== role) window.location.href = 'login_page.html';
}