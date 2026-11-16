/* TorqueLine - Order Tracking Map (Leaflet + OpenStreetMap, free, no API key) */
(function() {
  if (typeof L === 'undefined') return;

  var WAREHOUSE = { lat: 14.5995, lng: 120.9842, label: 'TorqueLine Warehouse (Manila)' };
  var map = null;
  var routeLine = null;
  var markers = {};

  function session() {
    if (window.__DASHBOARD_SESSION__) return window.__DASHBOARD_SESSION__;
    try {
      var raw = localStorage.getItem('torqueline_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function initMap() {
    var el = document.getElementById('tracking-map');
    if (!el) return;
    map = L.map('tracking-map').setView([WAREHOUSE.lat, WAREHOUSE.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 18
    }).addTo(map);

    var whIcon = L.divIcon({
      className: '', iconSize: [32, 32], iconAnchor: [16, 32],
      html: '<div style="background:#dc2626;color:#fff;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)">W</div>'
    });
    L.marker([WAREHOUSE.lat, WAREHOUSE.lng], { icon: whIcon }).addTo(map)
      .bindPopup(WAREHOUSE.label);
  }

  function setRoute(from, to, status) {
    if (!map) initMap();
    if (!map) return;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (markers.customer) { map.removeLayer(markers.customer); markers.customer = null; }

    var points = [[from.lat, from.lng], [to.lat, to.lng]];
    var color = status === 'Delivered' ? '#16a34a' : status === 'Shipped' ? '#2563eb' : '#dc2626';
    routeLine = L.polyline(points, { color: color, weight: 4, opacity: 0.8, dashArray: '8, 6' }).addTo(map);

    var custIcon = L.divIcon({
      className: '', iconSize: [32, 32], iconAnchor: [16, 32],
      html: '<div style="background:' + color + ';color:#fff;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.3)">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>'
    });
    markers.customer = L.marker([to.lat, to.lng], { icon: custIcon }).addTo(map)
      .bindPopup('Delivery Address');

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  }

  // Default customer location (Metro Manila) - overridden by profile location if set
  function customerLocation() {
    var s = session();
    var loc = s && s.location ? String(s.location) : '';
    // Try geocoding via Nominatim (free, no key)
    return fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(loc || 'Manila, Philippines') + '&format=json&limit=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data[0]) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: loc || 'Delivery Address' };
        }
        return { lat: 14.5995, lng: 120.9842, label: 'Manila (default)' };
      })
      .catch(function() {
        return { lat: 14.6, lng: 121.0, label: 'Metro Manila' };
      });
  }

  function renderTrackingInfo(order) {
    var info = document.getElementById('tracking-info');
    var label = document.getElementById('tracking-status-label');
    if (!info || !order) return;
    label.textContent = order.status || 'Unknown';
    label.className = 'text-xs font-semibold ' +
      (order.status === 'Delivered' ? 'text-green-600' :
       order.status === 'Shipped' ? 'text-blue-600' :
       order.status === 'Cancelled' ? 'text-gray-500' : 'text-red-600');

    var steps = [
      { key: 'Order Placed', label: 'Placed', done: true },
      { key: 'Paid', label: 'Paid', done: ['Paid','Processing','Shipped','Delivered'].indexOf(order.status) >= 0 },
      { key: 'Shipped', label: 'Shipped', done: ['Shipped','Delivered'].indexOf(order.status) >= 0 },
      { key: 'Delivered', label: 'Delivered', done: order.status === 'Delivered' }
    ];

    var html = '';
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var cls = s.done ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200';
      html += '<div class="rounded-lg border px-3 py-2 ' + cls + ' text-center">' +
        '<p class="text-[10px] font-bold uppercase">' + s.label + '</p>' +
        (s.done ? '<p class="text-xs mt-0.5">&#10003; Done</p>' : '<p class="text-xs mt-0.5">Pending</p>') +
        '</div>';
    }
    info.innerHTML = html;
    info.classList.remove('hidden');
  }

  function populateOrderSelect(orders) {
    var sel = document.getElementById('tracking-order-select');
    if (!sel) return;
    if (!orders || !orders.length) {
      sel.innerHTML = '<p class="text-sm text-gray-500">No orders to track.</p>';
      return;
    }
    var html = '<label class="block text-xs font-semibold text-gray-600 mb-1">Select Order</label>' +
      '<select id="tracking-select-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500">';
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      html += '<option value="' + o.id + '">' + (o.id || 'Order') + ' — ' + (o.status || 'Unknown') + ' — ' + (o.total || '') + '</option>';
    }
    html += '</select>';
    sel.innerHTML = html;

    var input = document.getElementById('tracking-select-input');
    if (input) {
      input.addEventListener('change', function() {
        var id = this.value;
        var order = orders.filter(function(o) { return String(o.id) === String(id); })[0];
        if (order) trackOrder(order);
      });
      // Auto-select first
      trackOrder(orders[0]);
    }
  }

  function trackOrder(order) {
    if (!order) return;
    renderTrackingInfo(order);
    customerLocation().then(function(cust) {
      setRoute(WAREHOUSE, cust, order.status);
    });
  }

  function init() {
    var s = session();
    if (!s) return;
    var orders = window.__USER_ORDERS__ || [];
    if (!orders.length) {
      // Try to read from user-dashboard
      var list = document.getElementById('orders-list');
      if (!list || !list.children.length) {
        var sel = document.getElementById('tracking-order-select');
        if (sel) sel.innerHTML = '<p class="text-sm text-gray-500">No orders to track yet.</p>';
        return;
      }
    }
    populateOrderSelect(orders);
  }

  // Expose for user-dashboard.js to call after loading orders
  window.TL_TRACKING = {
    init: init,
    setOrders: function(orders) {
      window.__USER_ORDERS__ = orders || [];
      populateOrderSelect(orders);
    },
    trackOrder: trackOrder
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();