// ===== Admin Dashboard + Client Order History =====
const adminPanel = document.getElementById('admin-panel');
const adminOverlay = document.getElementById('admin-overlay');
const ordersModal = document.getElementById('orders-modal');
const ordersOverlay = document.getElementById('orders-overlay');

const CATALOGUE = [
  { name: 'Full Synthetic 5W-30', price: 1399, stock: 42 },
  { name: 'High Mileage 0W-20', price: 1549, stock: 28 },
  { name: 'Diesel Blend 10W-40', price: 1699, stock: 19 },
  { name: 'Mobil 1', price: 1699, stock: 15 },
  { name: 'Castrol EDGE', price: 1549, stock: 22 },
  { name: 'Shell Helix', price: 1399, stock: 31 },
  { name: 'Total Quartz', price: 1499, stock: 12 },
  { name: 'BP VEG', price: 1299, stock: 26 },
  { name: 'ARKO Tection', price: 1149, stock: 35 },
  { name: 'Liqui Moly', price: 1849, stock: 9 }
];

// ===== Admin Panel =====
function openAdminPanel() {
  if (!isAdmin()) {
    showNotification('Admin access required. Please sign in with a staff account.');
    openAuthModal('admin', 'login');
    return;
  }

  renderAdminPanel();

  adminPanel?.classList.remove('hidden');
  adminOverlay?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAdminPanel() {
  adminPanel?.classList.add('hidden');
  adminOverlay?.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderAdminPanel() {
  const orders = getOrders();
  const users = getUsers().filter(u => u.role !== 'admin');
  const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const itemCount = orders.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + i.quantity, 0), 0);
  const avgOrder = orders.length ? revenue / orders.length : 0;

  // Stats
  const stats = [
    { label: 'Total Orders', value: orders.length, tone: 'red' },
    { label: 'Revenue', value: formatPrice(revenue), tone: 'green' },
    { label: 'Registered Clients', value: users.length, tone: 'blue' },
    { label: 'Avg. Order Value', value: formatPrice(avgOrder), tone: 'amber' }
  ];

  const statsEl = document.getElementById('admin-stats');
  if (statsEl) {
    statsEl.innerHTML = stats.map(s => `
      <div class="admin-stat admin-stat-${s.tone}">
        <p class="admin-stat-label">${s.label}</p>
        <p class="admin-stat-value">${s.value}</p>
      </div>
    `).join('');
  }

  // Orders table
  const tbody = document.getElementById('admin-orders-body');
  const empty = document.getElementById('admin-orders-empty');
  if (tbody) {
    tbody.innerHTML = orders.length ? orders.map(o => `
      <tr>
        <td class="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">${o.id}</td>
        <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${escapeHtml(o.customer || 'Guest')}</td>
        <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${escapeHtml(o.payment || '—')}</td>
        <td class="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">${formatPrice(o.total || 0)}</td>
        <td class="px-4 py-3"><span class="admin-status">${escapeHtml(o.status || 'Processing')}</span></td>
      </tr>
    `).join('') : '';
  }
  empty?.classList.toggle('hidden', orders.length > 0);

  // Users
  const usersList = document.getElementById('admin-users-list');
  const usersEmpty = document.getElementById('admin-users-empty');
  if (usersList) {
    usersList.innerHTML = users.map(u => {
      const userOrders = orders.filter(o => o.userId === u.id).length;
      return `
        <div class="admin-user-row">
          <span class="admin-user-avatar">${u.name.trim().charAt(0).toUpperCase()}</span>
          <span class="admin-user-meta">
            <span class="admin-user-name">${escapeHtml(u.name)}</span>
            <span class="admin-user-email">${escapeHtml(u.email)}</span>
          </span>
          <span class="admin-user-orders">${userOrders} order${userOrders === 1 ? '' : 's'}</span>
        </div>
      `;
    }).join('');
  }
  usersEmpty?.classList.toggle('hidden', users.length > 0);

  // Catalogue
  const productsList = document.getElementById('admin-products-list');
  if (productsList) {
    productsList.innerHTML = CATALOGUE.map(p => {
      const tone = p.stock > 20 ? 'ok' : p.stock > 10 ? 'low' : 'critical';
      return `
        <div class="admin-product-row">
          <span class="admin-product-name">${escapeHtml(p.name)}</span>
          <span class="admin-product-price">${formatPrice(p.price)}</span>
          <span class="admin-stock admin-stock-${tone}">${p.stock} in stock</span>
        </div>
      `;
    }).join('');
  }
}

// ===== Client Orders =====
function openOrdersPanel() {
  if (!isLoggedIn()) {
    showNotification('Please sign in to view your orders.');
    openAuthModal('client', 'login');
    return;
  }

  renderOrdersPanel();

  ordersModal?.classList.remove('hidden');
  ordersOverlay?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeOrdersPanel() {
  ordersModal?.classList.add('hidden');
  ordersOverlay?.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderOrdersPanel() {
  const list = document.getElementById('orders-list');
  const subtitle = document.getElementById('orders-subtitle');
  if (!list) return;

  const allOrders = getOrders();
  const orders = allOrders.filter(o => o.userId === currentUser.id);

  if (subtitle) {
    subtitle.textContent = orders.length
      ? `${orders.length} order${orders.length === 1 ? '' : 's'} placed by ${currentUser.email}`
      : 'You have not placed any orders yet';
  }

  if (!orders.length) {
    list.innerHTML = `
      <div class="text-center py-10">
        <span class="inline-flex w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
          <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 9.4V19a2 2 0 01-2 2z"></path>
          </svg>
        </span>
        <p class="font-bold text-gray-900">No orders yet</p>
        <p class="text-sm text-gray-500 mt-1">Your purchases will appear here once you check out.</p>
        <a href="#products" id="orders-shop-link" class="inline-block mt-5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">Shop Products</a>
      </div>
    `;
    document.getElementById('orders-shop-link')?.addEventListener('click', closeOrdersPanel);
    return;
  }

  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <p class="font-black text-gray-900">${o.id}</p>
          <p class="text-xs text-gray-500 mt-0.5">${formatDate(o.date)}</p>
        </div>
        <span class="admin-status">${escapeHtml(o.status || 'Processing')}</span>
      </div>
      <div class="order-card-items">
        ${(o.items || []).map(item => `
          <div class="order-item">
            <span class="order-item-name">${escapeHtml(item.name)}</span>
            <span class="order-item-qty">x${item.quantity}</span>
            <span class="order-item-price">${formatPrice(item.price * item.quantity)}</span>
          </div>
        `).join('')}
      </div>
      <div class="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
        <span class="text-xs text-gray-500">Paid via ${escapeHtml(o.payment || '—')}</span>
        <span class="font-black text-red-600">${formatPrice(o.total || 0)}</span>
      </div>
    </div>
  `).join('');
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ===== Event Listeners =====
document.getElementById('admin-close')?.addEventListener('click', closeAdminPanel);
adminOverlay?.addEventListener('click', closeAdminPanel);
document.getElementById('orders-close')?.addEventListener('click', closeOrdersPanel);
ordersOverlay?.addEventListener('click', closeOrdersPanel);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (adminPanel && !adminPanel.classList.contains('hidden')) closeAdminPanel();
  if (ordersModal && !ordersModal.classList.contains('hidden')) closeOrdersPanel();
});
