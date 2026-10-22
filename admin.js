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

// ===== Admin: Enhanced Orders Management =====
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
    tbody.innerHTML = orders.length ? orders.slice(0, 50).map(o => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">${o.id}</td>
        <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${escapeHtml(o.customer || 'Guest')}<br><span class="text-xs">${escapeHtml(o.phone || o.email || '')}</span></td>
        <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${escapeHtml(o.payment || '—')}</td>
        <td class="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">${formatPrice(o.total || 0)}</td>
        <td class="px-4 py-3"><span class="admin-status">${escapeHtml(o.status || 'Order Placed')}</span></td>
        
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

  list.innerHTML = orders.map(o => {
    const statusHistory = o.statusHistory || [{ status: o.status || 'Order Placed', timestamp: o.date }];
    const statuses = ['Order Placed', 'Paid', 'Packed', 'Out for Delivery', 'Delivered'];
    const currentIdx = statuses.indexOf(o.status) >= 0 ? statuses.indexOf(o.status) : 0;
    const estDelivery = o.estimatedDeliveryDate ? new Date(o.estimatedDeliveryDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBD';
    return `
    <div class="order-card border-2 border-gray-100">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <p class="font-black text-gray-900 text-lg">${o.id}</p>
          <p class="text-xs text-gray-500 mt-0.5">Placed: ${formatDate(o.date)}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold ${o.status === 'Delivered' ? 'bg-green-100 text-green-700' : o.status === 'Out for Delivery' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">${escapeHtml(o.status || 'Order Placed')}</span>
      </div>
      <div class="mb-4 p-3 bg-blue-50 rounded-lg">
        <p class="text-xs font-semibold text-blue-900 mb-1">Estimated Delivery</p>
        <p class="text-sm font-bold text-blue-700">${estDelivery}</p>
        ${o.rider ? `<p class="text-xs text-blue-700 mt-1">Rider: ${escapeHtml(o.rider)} ${o.riderContact ? '(' + escapeHtml(o.riderContact) + ')' : ''}</p>` : ''}
      </div>
      <div class="mb-4">
        <p class="text-xs font-bold text-gray-700 mb-2">Tracking Status</p>
        <div class="space-y-2">
          ${statuses.map((st, idx) => {
            const hist = statusHistory.find(h => h.status === st);
            const done = idx <= currentIdx;
            return `
              <div class="flex gap-2">
                <div class="flex flex-col items-center">
                  <div class="w-3 h-3 rounded-full ${done ? 'bg-green-500' : 'bg-gray-300'}"></div>
                  ${idx < statuses.length - 1 ? `<div class="w-0.5 h-8 ${done && idx < currentIdx ? 'bg-green-500' : 'bg-gray-300'}"></div>` : ''}
                </div>
                <div class="flex-1 pb-2">
                  <p class="text-xs font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}">${st}</p>
                  ${hist ? `<p class="text-[10px] text-gray-500">${new Date(hist.timestamp).toLocaleString('en-PH')}</p>${hist.note ? `<p class="text-[10px] text-gray-600">${escapeHtml(hist.note)}</p>` : ''}` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="order-card-items mb-3">
        <p class="text-xs font-bold text-gray-700 mb-2">Items Ordered</p>
        ${(o.items || []).map(item => `
          <div class="order-item flex justify-between text-xs py-1">
            <span class="order-item-name flex-1">${escapeHtml(item.brand || '')} ${escapeHtml(item.type || item.name)}${item.quantity > 1 ? ' x' + item.quantity : ''}</span>
            <span class="order-item-price font-semibold">${formatPrice(item.price * item.quantity)}</span>
          </div>
        `).join('')}
      </div>
      <div class="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
        <span class="text-xs text-gray-500">Paid via ${escapeHtml(o.payment || '—')} ${o.deliveryFee ? '| Delivery: ' + formatPrice(o.deliveryFee) : ''}</span>
        <span class="font-black text-red-600">${formatPrice(o.total || 0)}</span>
      </div>
      ${o.proofOfDelivery ? `<div class="mt-3"><p class="text-xs font-bold text-gray-700 mb-1">Proof of Delivery</p><img src="${escapeHtml(o.proofOfDelivery)}" alt="Proof" class="w-full max-w-xs rounded border"></div>` : ''}
      ${o.adminNotes ? `<div class="mt-3 p-2 bg-gray-50 rounded"><p class="text-xs font-bold text-gray-700 mb-1">Notes</p><p class="text-xs text-gray-600">${escapeHtml(o.adminNotes)}</p></div>` : ''}
    </div>
  `;
  }).join('');
}
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

// ===== Admin Order Management =====
