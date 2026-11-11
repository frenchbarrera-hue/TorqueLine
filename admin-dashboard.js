(function() {
  var session = window.__DASHBOARD_SESSION__;
  if (!session) return;

  var USERS_KEY = 'torqueline_users';
  var ORDERS_KEY = 'torqueline_orders';
  var ORDERS_KEY_ALT = 'torquelle_orders';

  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
  }
  function formatDate(v) {
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

  var salesChart = null;

  function render() {
    var users = loadJSON(USERS_KEY, []);
    var orders = loadJSON(ORDERS_KEY, []);
    var altOrders = loadJSON(ORDERS_KEY_ALT, []);
    if (!orders.length && altOrders.length) orders = altOrders;
    var clients = users.filter(function(u){ return u.role !== 'admin'; });
    var revenue = orders.reduce(function(sum,o){ return sum + (o.total||0); }, 0);

    document.getElementById('welcome-name').textContent = session.name || 'Admin';
    var short = document.getElementById('admin-name-short');
    if (short) short.textContent = session.name || 'Admin';

    var stats = [
      { label: 'Total Users', value: clients.length },
      { label: 'Total Orders', value: orders.length },
      { label: 'Revenue', value: formatPrice(revenue) },
      { label: 'Avg. Order', value: formatPrice(orders.length ? revenue / orders.length : 0) }
    ];
    var statsEl = document.getElementById('admin-stats');
    if (statsEl) {
      statsEl.innerHTML = stats.map(function(s){
        return '<div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p class="text-xs text-gray-500 font-medium uppercase tracking-wide">' + esc(s.label) + '</p><p class="text-2xl font-black text-gray-900 mt-1">' + esc(String(s.value)) + '</p></div>';
      }).join('');
    }

    var body = document.getElementById('users-body');
    var empty = document.getElementById('users-empty');
    if (body) {
      if (!users.length) {
        body.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
      } else {
        if (empty) empty.classList.add('hidden');
        body.innerHTML = users.map(function(u){
          var count = orders.filter(function(o){ return o.userId === u.id; }).length;
          var roleClass = u.role === 'admin' ? 'bg-gray-900 text-white' : 'bg-red-100 text-red-700';
          var roleLabel = u.role === 'admin' ? 'Admin' : 'User';
          return '<tr><td class="px-4 py-3 font-semibold text-gray-900">' + esc(u.name || '') + '</td><td class="px-4 py-3 text-gray-600">' + esc(u.email || '') + '</td><td class="px-4 py-3"><span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ' + roleClass + '">' + roleLabel + '</span></td><td class="px-4 py-3 text-gray-700">' + count + '</td><td class="px-4 py-3 text-gray-500">' + formatDate(u.createdAt) + '</td></tr>';
        }).join('');
      }
    }

    var summary = document.getElementById('recent-orders-summary');
    if (summary) summary.textContent = orders.length ? orders.length + ' total order' + (orders.length===1?'':'s') + ', ' + formatPrice(revenue) + ' revenue' : 'No orders recorded yet';

    var salesMap = {};
    orders.forEach(function(o) {
      (o.items || []).forEach(function(it) {
        var key = it.brand || it.name || 'Unknown';
        var qty = Number(it.quantity || 1);
        salesMap[key] = (salesMap[key] || 0) + (isNaN(qty) ? 1 : qty);
      });
    });
    var salesEntries = Object.keys(salesMap).map(function(k){ return { label: k, value: salesMap[k] }; });
    salesEntries.sort(function(a,b){ return b.value - a.value; });
    salesEntries = salesEntries.slice(0, 8);

    var chartCanvas = document.getElementById('sales-chart');
    var chartEmpty = document.getElementById('sales-chart-empty');
    if (chartCanvas) {
      if (salesChart) { salesChart.destroy(); salesChart = null; }
      if (!salesEntries.length || typeof Chart === 'undefined') {
        chartCanvas.parentElement.classList.add('hidden');
        if (chartEmpty) chartEmpty.classList.remove('hidden');
      } else {
        chartCanvas.parentElement.classList.remove('hidden');
        if (chartEmpty) chartEmpty.classList.add('hidden');
        var colors = ['#dc2626','#ef4444','#b91c1c','#f97316','#fb923c','#991b1b','#f87171','#fca5a5'];
        salesChart = new Chart(chartCanvas, {
          type: 'bar',
          data: {
            labels: salesEntries.map(function(e){ return e.label; }),
            datasets: [{
              label: 'Units Sold',
              data: salesEntries.map(function(e){ return e.value; }),
              backgroundColor: salesEntries.map(function(_, i){ return colors[i % colors.length]; }),
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.parsed.y + ' units'; } } }
            },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } },
              x: { ticks: { maxRotation: 35, minRotation: 0 } }
            }
          }
        });
      }
    }

    var recent = document.getElementById('recent-orders');
    var recentEmpty = document.getElementById('recent-orders-empty');
    if (recent) {
      if (!orders.length) {
        recent.innerHTML = '';
        if (recentEmpty) recentEmpty.classList.remove('hidden');
      } else {
        if (recentEmpty) recentEmpty.classList.add('hidden');
        recent.innerHTML = orders.slice(0, 8).map(function(o){
          var status = o.status || 'Order Placed';
          var statusClass = status === 'Cancelled' ? 'text-red-600 font-semibold' : 'text-gray-500';
          var canAdvance = status === 'Order Placed' || status === 'Paid' || status === 'Packed' || status === 'Out for Delivery';
          var actionHtml = '';
          if (canAdvance) {
            actionHtml = '<button data-advance-order="' + esc(o.id) + '" class="confirm-sparkle-btn mt-2 w-full bg-gray-900 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">Set Order / Confirm</button>';
          } else if (status === 'Cancelled') {
            actionHtml = '<button disabled class="mt-2 w-full bg-gray-200 text-gray-500 text-xs font-bold px-3 py-2 rounded-lg cursor-not-allowed">Cancelled</button>';
          } else if (status === 'Delivered') {
            actionHtml = '<button disabled class="mt-2 w-full bg-gray-200 text-gray-500 text-xs font-bold px-3 py-2 rounded-lg cursor-not-allowed">Delivered</button>';
          }
          return '<div class="p-3 border border-gray-200 rounded-lg"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-900 text-sm">' + esc(o.id || 'Order') + '</p><p class="text-xs text-gray-500">' + esc(o.customer || 'Guest') + '</p></div><span class="text-xs font-bold text-red-600">' + formatPrice(o.total) + '</span></div><p class="text-xs mt-1 ' + statusClass + '">' + esc(status) + ' · ' + formatDate(o.date) + '</p>' + actionHtml + '</div>';
        }).join('');

        recent.querySelectorAll('[data-advance-order]').forEach(function(btn){
          btn.addEventListener('click', function(){
            var orderId = this.getAttribute('data-advance-order');
            if (!orderId) return;
            var steps = ['Order Placed', 'Paid', 'Packed', 'Out for Delivery', 'Delivered'];
            var latestOrders = loadJSON(ORDERS_KEY, []);
            var altOrders = loadJSON(ORDERS_KEY_ALT, []);
            if (!latestOrders.length && altOrders.length) latestOrders = altOrders;
            var idx = -1;
            for (var i = 0; i < latestOrders.length; i++) { if (latestOrders[i].id === orderId) { idx = i; break; } }
            if (idx < 0) { alert('Order not found.'); render(); return; }
            var currentStatus = latestOrders[idx].status || 'Order Placed';
            if (currentStatus === 'Cancelled' || currentStatus === 'Delivered') {
              alert(currentStatus === 'Cancelled' ? 'Cannot update a cancelled order.' : 'Order is already delivered.');
              render();
              return;
            }
            var currentIdx = steps.indexOf(currentStatus);
            if (currentIdx < 0 || currentIdx >= steps.length - 1) {
              alert('This order cannot be advanced.');
              render();
              return;
            }
            var nextStatus = steps[currentIdx + 1];
            if (!window.confirm('Are you sure you want to set ' + orderId + ' to "' + nextStatus + '"?')) return;

            // Re-check latest status right before saving
            var fresh = loadJSON(ORDERS_KEY, []);
            var freshAlt = loadJSON(ORDERS_KEY_ALT, []);
            if (!fresh.length && freshAlt.length) fresh = freshAlt;
            var fidx = -1;
            for (var j = 0; j < fresh.length; j++) { if (fresh[j].id === orderId) { fidx = j; break; } }
            if (fidx < 0) { alert('Order not found.'); render(); return; }
            if ((fresh[fidx].status || 'Order Placed') !== currentStatus) {
              alert('Order status changed. Please try again.');
              render();
              return;
            }
            fresh[fidx].status = nextStatus;
            if (!Array.isArray(fresh[fidx].statusHistory)) {
              fresh[fidx].statusHistory = [{ status: 'Order Placed', timestamp: fresh[fidx].date || new Date().toISOString(), note: 'Order received' }];
            }
            if (!fresh[fidx].statusHistory.some(function(h){ return h.status === nextStatus; })) {
              fresh[fidx].statusHistory.push({ status: nextStatus, timestamp: new Date().toISOString(), note: 'Updated by admin' });
            }
            try { localStorage.setItem(ORDERS_KEY, JSON.stringify(fresh)); } catch(e) {}
            render();
          });
        });
      }
    }
  }

  render();

  document.getElementById('logout-btn').addEventListener('click', function(){
    if (typeof window.dashboardLogout === 'function') window.dashboardLogout();
  });
  document.getElementById('refresh-data').addEventListener('click', render);
  document.getElementById('scroll-users').addEventListener('click', function(e){
    e.preventDefault();
    var el = document.querySelector('section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
})();