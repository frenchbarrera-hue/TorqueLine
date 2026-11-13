(function() {
  var session = window.__DASHBOARD_SESSION__;
  if (!session) return;

  var USERS_KEY = 'torqueline_users';
  var ORDERS_KEY = 'torqueline_orders';

  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
  }
  function formatDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function formatDateShort(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function formatPrice(n) {
    return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var users = loadJSON(USERS_KEY, []);
  var user = null;
  for (var i = 0; i < users.length; i++) { if (users[i].id === session.id) { user = users[i]; break; } }
  var allOrders = loadJSON(ORDERS_KEY, []);
  var orders = allOrders.filter(function(o){ return o.userId === session.id; });

  function getWeekStart(d) {
    var date = new Date(d);
    var day = date.getDay();
    var diff = (day === 0 ? -6 : 1) - day; // Monday start
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + diff);
    return date;
  }

  var weekStart = getWeekStart(new Date());
  var nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  var weeklySales = {};
  allOrders.forEach(function(o) {
    var od = new Date(o.date || o.createdAt || 0);
    if (isNaN(od.getTime())) return;
    if (od < weekStart || od >= nextWeekStart) return;
    (o.items || []).forEach(function(it) {
      var key = it.brand || it.name || 'Unknown';
      var qty = Number(it.quantity || 1);
      weeklySales[key] = (weeklySales[key] || 0) + (isNaN(qty) ? 1 : qty);
    });
  });
  var weeklyEntries = Object.keys(weeklySales).map(function(k){ return { label: k, value: weeklySales[k] }; });
  weeklyEntries.sort(function(a,b){ return b.value - a.value; });
  weeklyEntries = weeklyEntries.slice(0, 6);

  var chartCanvas = document.getElementById('weekly-brand-chart');
  var chartEmpty = document.getElementById('weekly-brand-empty');
  if (chartCanvas) {
    if (!weeklyEntries.length || typeof Chart === 'undefined') {
      chartCanvas.parentElement.classList.add('hidden');
      if (chartEmpty) chartEmpty.classList.remove('hidden');
    } else {
      chartCanvas.parentElement.classList.remove('hidden');
      if (chartEmpty) chartEmpty.classList.add('hidden');
      var colors = ['#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed','#0ea5e9'];
      new Chart(chartCanvas, {
        type: 'pie',
        data: {
          labels: weeklyEntries.map(function(e){ return e.label; }),
          datasets: [{
            data: weeklyEntries.map(function(e){ return e.value; }),
            backgroundColor: weeklyEntries.map(function(_, i){ return colors[i % colors.length]; }),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.label + ': ' + ctx.parsed + ' units'; } } }
          }
        }
      });
    }
  }

  document.getElementById('welcome-name').textContent = session.name || 'User';
  var short = document.getElementById('dash-user-name-short');
  if (short) short.textContent = (session.name || '').split(' ')[0] || 'User';
  document.getElementById('info-name').textContent = session.name || '—';
  document.getElementById('info-email').textContent = session.email || '—';
  document.getElementById('info-role').textContent = session.role === 'admin' ? 'Administrator' : 'User';
  document.getElementById('info-created').textContent = user ? formatDateShort(user.createdAt) : '—';
  document.getElementById('info-login').textContent = formatDate(session.loggedInAt);

  var totalSpent = orders.reduce(function(sum, o){ return sum + (o.total || 0); }, 0);
  var totalItems = orders.reduce(function(sum, o){ return sum + (o.items || []).reduce(function(s,i){ return s + (i.quantity||0); }, 0); }, 0);
  var stats = [
    { label: 'Total Orders', value: orders.length },
    { label: 'Items Purchased', value: totalItems },
    { label: 'Total Spent', value: formatPrice(totalSpent) }
  ];
  var statsEl = document.getElementById('activity-stats');
  if (statsEl) {
    statsEl.innerHTML = stats.map(function(s){
      return '<div class="bg-gray-50 rounded-xl p-4 border border-gray-100"><p class="text-xs text-gray-500 font-medium">' + esc(s.label) + '</p><p class="text-xl font-black text-gray-900 mt-1">' + esc(String(s.value)) + '</p></div>';
    }).join('');
  }

  var countEl = document.getElementById('orders-count');
  if (countEl) countEl.textContent = orders.length ? orders.length + ' order' + (orders.length === 1 ? '' : 's') : '';

  var list = document.getElementById('orders-list');
  var empty = document.getElementById('orders-empty');
  if (list) {
    if (!orders.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
    } else {
      if (empty) empty.classList.add('hidden');
      list.innerHTML = orders.slice(0, 10).map(function(o){
        var items = (o.items || []).map(function(it){ return esc(it.name || it.type || 'Item') + ' x' + (it.quantity||1); }).join(', ');
        var status = o.status || 'Order Placed';
        var statusClass = status === 'Cancelled' ? 'bg-red-100 text-red-700' : (status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700');
        var canCancel = status === 'Order Placed';
        var actionHtml = canCancel
          ? '<button data-cancel-order="' + esc(o.id) + '" class="cancel-user-order-btn w-full sm:w-auto bg-white border border-red-300 text-red-700 hover:bg-red-50 font-semibold px-4 py-2 rounded-lg transition-colors text-sm">Cancel Order</button>'
          : '<p class="text-sm text-gray-500">' + (status === 'Cancelled' ? 'This order was cancelled.' : 'This order can no longer be cancelled.') + '</p>';
        var msgBtn = '<button type="button" data-order-id="' + esc(o.id || '') + '" class="tl-message-admin-btn inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-9 7l3.5-3.5H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h.5z"/></svg>' +
          'Message Admin</button>';
        return '<div class="border border-gray-200 rounded-xl p-4"><div class="flex items-start justify-between gap-3"><div><p class="font-bold text-gray-900">' + esc(o.id || 'Order') + '</p><p class="text-xs text-gray-500 mt-0.5">' + formatDateShort(o.date) + '</p></div><span class="text-xs font-bold px-2 py-1 rounded-full ' + statusClass + '">' + esc(status) + '</span></div><p class="text-sm text-gray-600 mt-2">' + (items || '—') + '</p><div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-100"><span class="text-xs text-gray-500">' + esc(o.payment || '') + '</span><span class="font-bold text-red-600">' + formatPrice(o.total) + '</span></div><div class="pt-3 flex flex-col sm:flex-row sm:items-center gap-2">' + msgBtn + '<div class="sm:ml-auto">' + actionHtml + '</div></div></div>';
      }).join('');

      list.querySelectorAll('.cancel-user-order-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var orderId = this.getAttribute('data-cancel-order');
          if (!orderId) return;
          if (!window.confirm('Are you sure you want to cancel this order?')) return;

          // Re-check latest saved status before cancelling (prevents console/stale bypass)
          var all = loadJSON(ORDERS_KEY, []);
          var idx = -1;
          for (var i = 0; i < all.length; i++) { if (all[i].id === orderId && all[i].userId === session.id) { idx = i; break; } }
          if (idx < 0) { alert('Order not found.'); return; }
          var latestStatus = all[idx].status || 'Order Placed';
          if (latestStatus !== 'Order Placed') {
            alert(latestStatus === 'Cancelled' ? 'This order is already cancelled.' : 'This order can no longer be cancelled.');
            window.location.reload();
            return;
          }
          all[idx].status = 'Cancelled';
          if (!Array.isArray(all[idx].statusHistory)) {
            all[idx].statusHistory = [{ status: 'Order Placed', timestamp: all[idx].date || new Date().toISOString(), note: 'Order received' }];
          }
          all[idx].statusHistory.push({ status: 'Cancelled', timestamp: new Date().toISOString(), note: 'Cancelled by client' });
          try { localStorage.setItem(ORDERS_KEY, JSON.stringify(all)); } catch(e) {}
          window.location.reload();
        });
      });
    }
  }

  // ===== Profile (saved in a new localStorage key so existing data is safe) =====
  var PROFILE_KEY = 'torqueline_user_profiles';
  var BIO_MAX = 150;
  var PHOTO_MAX_BYTES = 300 * 1024; // 300 KB

  function loadProfiles() {
    return loadJSON(PROFILE_KEY, {});
  }

  function getProfile() {
    var profiles = loadProfiles();
    return profiles[session.id] || { photo: '', displayName: '', location: '', website: '', bio: '' };
  }

  function saveProfile(data) {
    var profiles = loadProfiles();
    profiles[session.id] = data;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles)); } catch (e) {}
  }

  function defaultAvatarSVG(sizeClass) {
    return '<svg class="' + (sizeClass || 'w-12 h-12') + ' text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
  }

  function renderAvatar(container, photo, sizeClass) {
    if (!container) return;
    if (photo) {
      container.innerHTML = '<img src="' + photo + '" alt="Profile picture" class="w-full h-full object-cover" />';
    } else {
      container.innerHTML = defaultAvatarSVG(sizeClass);
    }
  }

  function renderProfileView(profile) {
    renderAvatar(document.getElementById('profile-avatar'), profile.photo, 'w-12 h-12');
    var dn = document.getElementById('profile-display-name');
    if (dn) dn.textContent = profile.displayName || session.name || '—';
    var loc = document.getElementById('profile-location');
    if (loc) loc.textContent = profile.location || 'No location added';
    var bio = document.getElementById('profile-bio');
    if (bio) bio.textContent = profile.bio || 'No bio yet.';
    var web = document.getElementById('profile-website');
    if (web) {
      if (profile.website) {
        var href = profile.website;
        if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
        web.innerHTML = '<a href="' + esc(href) + '" target="_blank" rel="noopener" class="text-red-600 hover:text-red-700 underline">' + esc(profile.website) + '</a>';
      } else {
        web.textContent = 'No website added';
      }
    }
  }

  var currentProfile = getProfile();
  var pendingPhoto = currentProfile.photo || null; // null means keep existing; '' means removed/default

  function updateBioCounter() {
    var input = document.getElementById('profile-bio-input');
    var counter = document.getElementById('profile-bio-counter');
    if (!input || !counter) return;
    var left = BIO_MAX - (input.value || '').length;
    if (left < 0) left = 0;
    counter.textContent = left + ' character' + (left === 1 ? '' : 's') + ' left';
  }

  function showPhotoError(msg) {
    var el = document.getElementById('profile-photo-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
    else { el.textContent = ''; el.classList.add('hidden'); }
  }

  function showSaveMsg(msg) {
    var el = document.getElementById('profile-save-msg');
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
    else { el.textContent = ''; el.classList.add('hidden'); }
  }

  renderProfileView(currentProfile);

  var editBtn = document.getElementById('profile-edit-btn');
  var viewEl = document.getElementById('profile-view');
  var formEl = document.getElementById('profile-edit-form');
  var cancelBtn = document.getElementById('profile-cancel-btn');
  var photoInput = document.getElementById('profile-photo');

  function openEdit() {
    currentProfile = getProfile();
    pendingPhoto = currentProfile.photo || '';
    document.getElementById('profile-display-name-input').value = currentProfile.displayName || '';
    document.getElementById('profile-location-input').value = currentProfile.location || '';
    document.getElementById('profile-website-input').value = currentProfile.website || '';
    document.getElementById('profile-bio-input').value = currentProfile.bio || '';
    if (photoInput) photoInput.value = '';
    renderAvatar(document.getElementById('profile-preview'), pendingPhoto, 'w-12 h-12');
    updateBioCounter();
    showPhotoError('');
    showSaveMsg('');
    if (viewEl) viewEl.classList.add('hidden');
    if (formEl) formEl.classList.remove('hidden');
    if (editBtn) editBtn.textContent = 'Editing';
  }

  function closeEdit() {
    if (formEl) formEl.classList.add('hidden');
    if (viewEl) viewEl.classList.remove('hidden');
    if (editBtn) editBtn.textContent = 'Edit';
    showPhotoError('');
    showSaveMsg('');
  }

  if (editBtn) editBtn.addEventListener('click', function() {
    if (formEl && formEl.classList.contains('hidden')) openEdit(); else closeEdit();
  });
  if (cancelBtn) cancelBtn.addEventListener('click', closeEdit);

  var bioInput = document.getElementById('profile-bio-input');
  if (bioInput) bioInput.addEventListener('input', updateBioCounter);

  if (photoInput) photoInput.addEventListener('change', function(e) {
    var file = e.target.files && e.target.files[0];
    showPhotoError('');
    if (!file) {
      pendingPhoto = currentProfile.photo || '';
      renderAvatar(document.getElementById('profile-preview'), pendingPhoto, 'w-12 h-12');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      showPhotoError('That image is too large. Please choose an image that is 300 KB or smaller.');
      photoInput.value = '';
      pendingPhoto = currentProfile.photo || '';
      renderAvatar(document.getElementById('profile-preview'), pendingPhoto, 'w-12 h-12');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) {
      pendingPhoto = ev.target.result; // data URL for preview (and saved only on submit)
      renderAvatar(document.getElementById('profile-preview'), pendingPhoto, 'w-12 h-12');
    };
    reader.readAsDataURL(file);
  });

  if (formEl) formEl.addEventListener('submit', function(e) {
    e.preventDefault();
    var data = {
      photo: pendingPhoto || '',
      displayName: (document.getElementById('profile-display-name-input').value || '').trim(),
      location: (document.getElementById('profile-location-input').value || '').trim(),
      website: (document.getElementById('profile-website-input').value || '').trim(),
      bio: (document.getElementById('profile-bio-input').value || '').trim().slice(0, BIO_MAX)
    };
    saveProfile(data);
    currentProfile = data;
    renderProfileView(currentProfile);
    closeEdit();
  });

  document.getElementById('logout-btn').addEventListener('click', function(){
    if (typeof window.dashboardLogout === 'function') window.dashboardLogout();
  });
})();