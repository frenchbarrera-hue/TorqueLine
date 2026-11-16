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

  // Philippine city/province coordinates lookup (no external API needed, no CORS issues)
  var PH_CITIES = {
    'manila': { lat: 14.5995, lng: 120.9842 },
    'quezon city': { lat: 14.6760, lng: 120.9847 },
    'caloocan': { lat: 14.6507, lng: 120.9740 },
    'las pinas': { lat: 14.4425, lng: 120.9933 },
    'makati': { lat: 14.5547, lng: 121.0244 },
    'malabon': { lat: 14.6734, lng: 120.9568 },
    'mandaluyong': { lat: 14.5794, lng: 121.0359 },
    'marikina': { lat: 14.6507, lng: 121.1029 },
    'muntinlupa': { lat: 14.3833, lng: 121.0333 },
    'navotas': { lat: 14.6667, lng: 120.9333 },
    'paranaque': { lat: 14.4793, lng: 120.9794 },
    'pasay': { lat: 14.5378, lng: 120.9894 },
    'pasig': { lat: 14.5764, lng: 121.0851 },
    'san juan': { lat: 14.6060, lng: 121.0000 },
    'taguig': { lat: 14.5176, lng: 121.0509 },
    'valenzuela': { lat: 14.6956, lng: 120.9770 },
    'davao city': { lat: 7.0648, lng: 125.6080 },
    'davao': { lat: 7.0648, lng: 125.6080 },
    'cebu city': { lat: 10.3157, lng: 123.8854 },
    'cebu': { lat: 10.3157, lng: 123.8854 },
    'baguio': { lat: 16.4023, lng: 120.5960 },
    'cagayan de oro': { lat: 8.4806, lng: 124.6508 },
    'cdO': { lat: 8.4806, lng: 124.6508 },
    'general santos': { lat: 6.1164, lng: 125.1753 },
    'gen san santos': { lat: 6.1164, lng: 125.1753 },
    'iloilo city': { lat: 10.7202, lng: 122.5621 },
    'iloilo': { lat: 10.7202, lng: 122.5621 },
    'zamboanga city': { lat: 6.9214, lng: 122.0790 },
    'zamboanga': { lat: 6.9214, lng: 122.0790 },
    'bacolod': { lat: 10.6765, lng: 122.9510 },
    'cagayan': { lat: 18.0000, lng: 121.8333 },
    'bulacan': { lat: 14.8794, lng: 120.8792 },
    'cavite': { lat: 14.4167, lng: 120.9000 },
    'laguna': { lat: 14.2000, lng: 121.3333 },
    'rizal': { lat: 14.6333, lng: 121.2000 },
    'batangas': { lat: 13.7565, lng: 121.0581 },
    'pampanga': { lat: 15.0667, lng: 120.6667 },
    'pampanga': { lat: 15.0667, lng: 120.6667 },
    'tarlac': { lat: 15.4667, lng: 120.6000 },
    'pangasinan': { lat: 16.0000, lng: 120.3333 },
    'la union': { lat: 16.5000, lng: 120.3333 },
    'benguet': { lat: 16.5000, lng: 120.6667 },
    'tagaytay': { lat: 14.1167, lng: 120.9667 },
    'lucena': { lat: 13.1167, lng: 121.6167 },
    'naga': { lat: 13.6167, lng: 123.1833 },
    'legazpi': { lat: 13.1167, lng: 123.7333 },
    'tacloban': { lat: 11.2333, lng: 125.0000 },
    'ormoc': { lat: 11.0000, lng: 124.6000 },
    'roxas': { lat: 11.5833, lng: 122.7500 },
    'cotabato': { lat: 7.2167, lng: 124.2500 },
    'koronadal': { lat: 6.5833, lng: 124.1500 },
    'kidapawan': { lat: 7.0000, lng: 125.0000 },
    'digos': { lat: 6.7500, lng: 125.3500 },
    'midsayap': { lat: 7.1167, lng: 124.6000 },
    'tagum': { lat: 7.4167, lng: 125.6167 },
    'panabo': { lat: 7.2500, lng: 125.6167 },
    'santa cruz': { lat: 14.2833, lng: 121.4167 },
    'san pablo': { lat: 14.0667, lng: 121.3167 },
    'lipa': { lat: 13.9333, lng: 121.1667 },
    'tanauan': { lat: 14.1167, lng: 121.1500 },
    'malolos': { lat: 14.8500, lng: 120.8167 },
    'meycauayan': { lat: 14.7333, lng: 120.9667 },
    'san jose del monte': { lat: 14.8167, lng: 121.0333 },
    'antipolo': { lat: 14.5869, lng: 121.1244 },
    'cubao': { lat: 14.6167, lng: 121.0500 },
    'ortigas': { lat: 14.5833, lng: 121.0667 },
    'bGC': { lat: 14.5500, lng: 121.0500 },
    'makati': { lat: 14.5547, lng: 121.0244 },
  };

  function geocode(loc) {
    var lower = loc.toLowerCase();
    for (var key in PH_CITIES) {
      if (lower.indexOf(key) !== -1) return PH_CITIES[key];
    }
    // Default to Manila if city not found
    return { lat: 14.5995, lng: 120.9842 };
  }

  // Default customer location - from order's saved address
  function customerLocation(order) {
    var loc = '';

    // 1. Check order's saved delivery address (from checkout)
    if (order && order.shippingAddress) {
      var addr = order.shippingAddress;
      if (typeof addr === 'string') loc = addr;
      else if (addr.full) loc = addr.full;
      else if (addr.city || addr.province) loc = [addr.city, addr.province, 'Philippines'].filter(Boolean).join(', ');
    }

    // 2. Fallback: profile location
    if (!loc) {
      try {
        var s = session();
        var profiles = JSON.parse(localStorage.getItem('torqueline_user_profiles') || '{}');
        var p = profiles[s && s.id];
        if (p && p.location) loc = p.location;
      } catch(e) {}
    }

    // 3. Default: Manila
    if (!loc) loc = 'Manila, Philippines';

    var coords = geocode(loc);
    return Promise.resolve({ lat: coords.lat, lng: coords.lng, label: loc });
  }

  function renderTrackingInfo(order) {
    var info = document.getElementById('tracking-info');
    var label = document.getElementById('tracking-status-label');
    if (!info || !order) return;
    label.textContent = order.status || 'Unknown';
    label.className = 'text-xs font-semibold ' +
      (order.status === 'Delivered' ? 'text-green-600' :
       order.status === 'Out for Delivery' ? 'text-blue-600' :
       order.status === 'Shipped' ? 'text-blue-600' :
       order.status === 'Cancelled' ? 'text-gray-500' : 'text-red-600');

    var steps = [
      { key: 'Order Placed', label: 'Order Placed', done: true },
      { key: 'Packed', label: 'Packed', done: ['Packed','Shipped','Out for Delivery','Delivered'].indexOf(order.status) >= 0 },
      { key: 'Shipped', label: 'Shipped', done: ['Shipped','Out for Delivery','Delivered'].indexOf(order.status) >= 0 },
      { key: 'Out for Delivery', label: 'Out for Delivery', done: ['Out for Delivery','Delivered'].indexOf(order.status) >= 0 },
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
    customerLocation(order).then(function(cust) {
      setRoute(WAREHOUSE, cust, order.status);
    });
  }

  function init() {
    var s = session();
    if (!s) return;
    initMap();
    var orders = window.__USER_ORDERS__ || [];
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