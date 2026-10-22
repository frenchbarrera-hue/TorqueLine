// ===== Auth System (Client + Admin) =====
const USERS_KEY = 'torqueline_users';
const SESSION_KEY = 'torqueline_session';
const ORDERS_KEY = 'torqueline_orders';

const ADMIN_EMAIL = 'admin@torqueline.ph';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_ACCESS_CODE = 'TL-ADMIN';

// ===== Storage Helpers =====
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage unavailable — session stays in memory only
  }
}

function getUsers() {
  const users = loadJSON(USERS_KEY, []);
  if (!users.some(u => u.email === ADMIN_EMAIL)) {
    users.push({
      id: 'usr_admin',
      name: 'TorqueLine Admin',
      email: ADMIN_EMAIL,
      password: hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    saveJSON(USERS_KEY, users);
  }
  return users;
}

function getOrders() {
  return loadJSON(ORDERS_KEY, []);
}

// Simple obfuscation only — this is a front-end demo, not real security.
function hashPassword(value) {
  let hash = 5381;
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

let currentUser = loadJSON(SESSION_KEY, null);

function isLoggedIn() {
  return !!currentUser;
}

function isAdmin() {
  return !!currentUser && currentUser.role === 'admin';
}

// ===== Auth Actions =====
function loginUser(email, password, role, accessCode) {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());

  if (!user) {
    return { ok: false, error: 'No account found with that email address.' };
  }

  if (user.password !== hashPassword(password)) {
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }

  if (role === 'admin') {
    if (user.role !== 'admin') {
      return { ok: false, error: 'This account does not have administrator access.' };
    }
    if (String(accessCode || '').trim().toUpperCase() !== ADMIN_ACCESS_CODE) {
      return { ok: false, error: 'Invalid staff access code.' };
    }
  } else if (user.role === 'admin') {
    return { ok: false, error: 'Administrator accounts must sign in from the Admin tab.' };
  }

  startSession(user);
  return { ok: true, user };
}

function registerClient(name, email, password, confirm) {
  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim().toLowerCase();

  if (trimmedName.length < 2) {
    return { ok: false, error: 'Please enter your full name.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (password !== confirm) {
    return { ok: false, error: 'Passwords do not match.' };
  }

  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === trimmedEmail)) {
    return { ok: false, error: 'An account with that email already exists.' };
  }

  const user = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: trimmedName,
    email: trimmedEmail,
    password: hashPassword(password),
    role: 'client',
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveJSON(USERS_KEY, users);
  startSession(user);
  return { ok: true, user };
}

function startSession(user) {
  currentUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loggedInAt: new Date().toISOString()
  };
  saveJSON(SESSION_KEY, currentUser);
  renderAuthUI();
}

function logoutUser() {
  currentUser = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    // ignore
  }
  renderAuthUI();
}

// ===== Orders =====
function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  saveJSON(ORDERS_KEY, orders.slice(0, 100));
  return order;
}

// ===== Auth Modal =====
const authModal = document.getElementById('auth-modal');
const authOverlay = document.getElementById('auth-overlay');
const authTabIndicator = document.getElementById('auth-tab-indicator');
let activeAuthTab = 'client';
let authMode = 'login';

function setAuthTab(tab) {
  activeAuthTab = tab;

  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });

  if (authTabIndicator) {
    authTabIndicator.style.transform = tab === 'admin' ? 'translateX(100%)' : 'translateX(0)';
  }

  document.getElementById('client-login-form')?.classList.toggle('hidden', tab !== 'client' || authMode !== 'login');
  document.getElementById('client-register-form')?.classList.toggle('hidden', tab !== 'client' || authMode !== 'register');
  document.getElementById('admin-login-form')?.classList.toggle('hidden', tab !== 'admin');

  const subtitle = document.getElementById('auth-subtitle');
  if (subtitle) {
    subtitle.textContent = tab === 'admin'
      ? 'Staff access to the distributor dashboard'
      : authMode === 'register'
        ? 'Create your TorqueLine customer account'
        : 'Sign in to continue to TorqueLine';
  }
}

function setAuthMode(mode) {
  authMode = mode;
  setAuthTab(activeAuthTab);
}

function openAuthModal(tab = 'client', mode = 'login') {
  activeAuthTab = tab;
  authMode = mode;
  setAuthTab(tab);
  setAuthMode(mode);
  clearAuthErrors();
  if (authModal) authModal.classList.remove('hidden');
  if (authOverlay) authOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  if (authModal) authModal.classList.add('hidden');
  if (authOverlay) authOverlay.classList.add('hidden');
  if (typeof checkoutModal !== 'undefined' && checkoutModal && checkoutModal.classList.contains('hidden')) {
    document.body.style.overflow = '';
  }
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent = '';
    el.classList.add('hidden');
  });
}

function showAuthError(formId, message) {
  const form = document.getElementById(formId);
  if (!form) return;
  const box = form.querySelector('.auth-error');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

// ===== Navbar Rendering =====
function renderAuthUI() {
  const guestMenu = document.getElementById('account-menu-guest');
  const userMenu = document.getElementById('account-menu-user');
  const label = document.getElementById('account-label');
  const avatar = document.getElementById('account-avatar');
  const nameEl = document.getElementById('menu-user-name');
  const emailEl = document.getElementById('menu-user-email');
  const roleEl = document.getElementById('menu-user-role');
  const adminBtn = document.getElementById('menu-admin-panel');
  const mobileSignin = document.getElementById('mobile-signin');
  const mobileOrders = document.getElementById('mobile-orders');

  if (isLoggedIn()) {
    guestMenu?.classList.add('hidden');
    userMenu?.classList.remove('hidden');

    if (label) label.textContent = currentUser.name.split(' ')[0];
    if (avatar) {
      avatar.innerHTML = `<span class="text-xs font-black ${isAdmin() ? 'text-white' : 'text-red-600'}">${currentUser.name.trim().charAt(0).toUpperCase()}</span>`;
      avatar.className = isAdmin()
        ? 'w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs font-bold shrink-0'
        : 'w-8 h-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-xs font-bold shrink-0';
    }
    if (nameEl) nameEl.textContent = currentUser.name;
    if (emailEl) emailEl.textContent = currentUser.email;
    if (roleEl) {
      roleEl.textContent = isAdmin() ? 'Administrator' : 'Client';
      roleEl.className = isAdmin()
        ? 'inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-900 text-white'
        : 'inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700';
    }
    adminBtn?.classList.toggle('hidden', !isAdmin());
    if (mobileSignin) mobileSignin.textContent = 'Log Out';
    mobileOrders?.classList.remove('hidden');
  } else {
    guestMenu?.classList.remove('hidden');
    userMenu?.classList.add('hidden');

    if (label) label.textContent = 'Sign In';
    if (avatar) {
      avatar.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
      avatar.className = 'w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0';
    }
    adminBtn?.classList.add('hidden');
    if (mobileSignin) mobileSignin.textContent = 'Sign In';
    mobileOrders?.classList.add('hidden');
  }
}

// ===== Account Dropdown =====
const accountBtn = document.getElementById('account-btn');
const accountMenu = document.getElementById('account-menu');

function toggleAccountMenu(force) {
  if (!accountMenu) return;
  const open = force !== undefined ? force : accountMenu.classList.contains('hidden');
  accountMenu.classList.toggle('hidden', !open);
  accountBtn?.setAttribute('aria-expanded', String(open));
}

accountBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAccountMenu();
});

document.addEventListener('click', (e) => {
  if (accountMenu && !accountMenu.contains(e.target) && !accountBtn?.contains(e.target)) {
    toggleAccountMenu(false);
  }
});

// ===== Event Listeners =====
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    clearAuthErrors();
    setAuthTab(tab.dataset.tab);
  });
});

document.querySelectorAll('.auth-switch-to-register').forEach(btn => {
  btn.addEventListener('click', () => {
    clearAuthErrors();
    setAuthMode('register');
  });
});

document.querySelectorAll('.auth-switch-to-login').forEach(btn => {
  btn.addEventListener('click', () => {
    clearAuthErrors();
    setAuthMode('login');
  });
});

document.querySelectorAll('.auth-toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

document.getElementById('client-login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('client-email').value;
  const password = document.getElementById('client-password').value;
  const result = loginUser(email, password, 'client');

  if (!result.ok) {
    showAuthError('client-login-form', result.error);
    return;
  }

  closeAuthModal();
  showNotification(`Welcome back, ${result.user.name.split(' ')[0]}! You are now signed in.`);
});

document.getElementById('client-register-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  clearAuthErrors();

  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const result = registerClient(name, email, password, confirm);

  if (!result.ok) {
    showAuthError('client-register-form', result.error);
    return;
  }

  closeAuthModal();
  showNotification(`Account created! Welcome to TorqueLine, ${result.user.name.split(' ')[0]}.`);
});

document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;
  const code = document.getElementById('admin-code').value;
  const result = loginUser(email, password, 'admin', code);

  if (!result.ok) {
    showAuthError('admin-login-form', result.error);
    return;
  }

  closeAuthModal();
  showNotification('Admin session started. Opening the dashboard.');
  setTimeout(() => openAdminPanel(), 250);
});

document.getElementById('fill-demo-creds')?.addEventListener('click', () => {
  const email = document.getElementById('admin-email');
  const password = document.getElementById('admin-password');
  const code = document.getElementById('admin-code');

  if (email) email.value = ADMIN_EMAIL;
  if (password) password.value = ADMIN_PASSWORD;
  if (code) code.value = ADMIN_ACCESS_CODE;

  showNotification('Demo credentials filled in. Press "Sign In as Admin".');
});

document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
authOverlay?.addEventListener('click', closeAuthModal);

document.getElementById('menu-signin')?.addEventListener('click', () => {
  toggleAccountMenu(false);
  openAuthModal('client', 'login');
});

document.getElementById('menu-signup')?.addEventListener('click', () => {
  toggleAccountMenu(false);
  openAuthModal('client', 'register');
});

document.getElementById('menu-orders')?.addEventListener('click', () => {
  toggleAccountMenu(false);
  openOrdersPanel();
});

document.getElementById('menu-admin-panel')?.addEventListener('click', () => {
  toggleAccountMenu(false);
  openAdminPanel();
});

document.getElementById('menu-logout')?.addEventListener('click', () => {
  toggleAccountMenu(false);
  logoutUser();
  showNotification('You have been signed out.');
});

document.getElementById('mobile-signin')?.addEventListener('click', () => {
  document.getElementById('mobile-menu')?.classList.add('hidden');
  if (isLoggedIn()) {
    logoutUser();
    showNotification('You have been signed out.');
  } else {
    openAuthModal('client', 'login');
  }
});

document.getElementById('mobile-orders')?.addEventListener('click', () => {
  document.getElementById('mobile-menu')?.classList.add('hidden');
  openOrdersPanel();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (authModal && !authModal.classList.contains('hidden')) {
    closeAuthModal();
  }
});

// ===== Initial Render =====
getUsers();
renderAuthUI();
