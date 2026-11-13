(function() {
  var POLL_MS = 3000;
  var ADMIN_ID = 'usr_admin';

  function getSession() {
    if (window.__DASHBOARD_SESSION__) return window.__DASHBOARD_SESSION__;
    try {
      var raw = localStorage.getItem('torqueline_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function authHeaders() {
    var s = getSession();
    if (!s) return null;
    return {
      'Content-Type': 'application/json',
      'X-User-Id': String(s.id || ''),
      'X-User-Role': String(s.role || 'client'),
      'X-User-Name': String(s.name || '')
    };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtTime(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Change this if your backend runs on a different address/port.
  var API_BASE_URL = 'http://127.0.0.1:8080';

  function apiUrl(path) {
    if (typeof path !== 'string') return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    return API_BASE_URL + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = authHeaders();
    if (!headers) return Promise.reject(new Error('Not logged in. Please sign in again.'));
    var fetchOpts = {
      method: opts.method || 'GET',
      headers: Object.assign({}, headers, opts.headers || {}),
      cache: 'no-store'
    };
    if (opts.body) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.body);
    }
    var url = apiUrl(path);
    return fetch(url, fetchOpts).then(function(res) {
      return res.text().then(function(text){
        var data = {};
        try { data = text ? JSON.parse(text) : {}; } catch(e) { data = { error: text || '' }; }
        if (!res.ok) {
          var serverMsg = data.error || '';
          var msg = '';
          if (res.status === 404) {
            msg = 'Could not find the messaging address on the server (' + url + '). Start the server with: python3 server.py and open http://127.0.0.1:8080, then refresh the page.';
          } else if (res.status === 405) {
            msg = 'The server received the request but did not allow this action (sending/loading). Start the server with: python3 server.py and open http://127.0.0.1:8080, then refresh the page.';
          } else if (res.status === 401) {
            msg = 'You are not logged in (or your session expired). Please log in again.';
          } else if (res.status === 403) {
            msg = 'You are not allowed to view or send this conversation.';
          } else if (res.status >= 500) {
            msg = 'The messaging server had a problem. Start the server with: python3 server.py and open http://127.0.0.1:8080, then try again.' + (serverMsg ? ' (' + serverMsg + ')' : '');
          } else {
            msg = serverMsg || 'Something went wrong while sending/loading messages. Start the server with: python3 server.py and open http://127.0.0.1:8080, then try again.';
          }
          var err = new Error(msg);
          err.status = res.status;
          err.path = data.path || path;
          err.url = url;
          throw err;
        }
        return data;
      });
    }).catch(function(err){
      if (err && typeof err.status === 'number') throw err;
      // Network error / server not running / blocked connection
      if (err && err instanceof TypeError) {
        throw new Error('Cannot reach the messaging server. Start the server with: python3 server.py and open http://127.0.0.1:8080, then refresh the page.');
      }
      if (err && err.message) throw err;
      throw new Error('Cannot reach the messaging server. Start the server with: python3 server.py and open http://127.0.0.1:8080, then refresh the page.');
    });
  }

  function ensureChatStyles() {
    if (document.getElementById('tl-chat-styles')) return;
    var style = document.createElement('style');
    style.id = 'tl-chat-styles';
    style.textContent = '' +
      '.tl-chat-panel{position:fixed;right:1rem;bottom:1rem;width:22rem;max-width:calc(100vw - 2rem);height:30rem;max-height:70vh;background:#fff;border:1px solid #e5e7eb;border-radius:1rem;box-shadow:0 20px 45px rgba(0,0,0,.18);z-index:70;display:flex;flex-direction:column;overflow:hidden}' +
      '.tl-chat-panel.tl-hidden{display:none}' +
      '.tl-chat-header{padding:.75rem 1rem;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#111827,#7f1d1d);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:.5rem}' +
      '.tl-chat-body{flex:1;overflow-y:auto;padding:.75rem;background:#f9fafb}' +
      '.tl-chat-msg{max-width:80%;margin-bottom:.5rem;padding:.5rem .75rem;border-radius:.75rem;font-size:.875rem;line-height:1.35;word-wrap:break-word;white-space:pre-wrap}' +
      '.tl-chat-msg.me{margin-left:auto;background:#dc2626;color:#fff;border-bottom-right-radius:.25rem}' +
      '.tl-chat-msg.them{margin-right:auto;background:#fff;color:#111827;border:1px solid #e5e7eb;border-bottom-left-radius:.25rem}' +
      '.tl-chat-time{display:block;font-size:.7rem;opacity:.75;margin-top:.2rem}' +
      '.tl-chat-footer{padding:.6rem;border-top:1px solid #e5e7eb;background:#fff;display:flex;gap:.5rem}' +
      '.tl-chat-input{flex:1;border:1px solid #d1d5db;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}' +
      '.tl-chat-input:focus{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.15)}' +
      '.tl-msg-badge{position:absolute;top:-.35rem;right:-.35rem;min-width:1.1rem;height:1.1rem;padding:0 .25rem;border-radius:9999px;background:#dc2626;color:#fff;font-size:.7rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:2px solid #fff}' +
      '.tl-thread{width:100%;text-align:left;padding:.75rem;border:1px solid #e5e7eb;border-radius:.75rem;background:#fff}' +
      '.tl-thread:hover{border-color:#fca5a5;background:#fff7f7}' +
      '@media (max-width:640px){.tl-chat-panel{left:.5rem;right:.5rem;bottom:.5rem;width:auto;height:65vh}}';
    document.head.appendChild(style);
  }

    function renderMessages(container, messages, myId) {
    if (!messages || !messages.length) {
      container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No messages yet. Start the conversation.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var mine = String(m.sender_id) === String(myId);
      html += '<div class="tl-chat-msg ' + (mine ? 'me' : 'them') + '">' +
        esc(m.message) +
        '<span class="tl-chat-time">' + esc(fmtTime(m.created_at)) + '</span></div>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function timeAgo(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + ' sec ago';
    var m = Math.floor(diff / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' hr ago';
    var days = Math.floor(h / 24);
    if (days < 7) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  // ===== Client (user dashboard): Message Admin per order =====
  function initClientMessaging() {
    var session = getSession();
    if (!session || session.role === 'admin') return;
    ensureChatStyles();

    var panel = document.getElementById('tl-client-chat');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tl-client-chat';
      panel.className = 'tl-chat-panel tl-hidden';
      panel.innerHTML =
        '<div class="tl-chat-header">' +
          '<div><p class="text-sm font-bold">Message Admin</p><p id="tl-client-chat-sub" class="text-xs text-red-100">General concern</p></div>' +
          '<button id="tl-client-chat-close" class="text-white/80 hover:text-white" aria-label="Close chat">' +
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="tl-client-chat-body" class="tl-chat-body"></div>' +
        '<div id="tl-client-chat-status" class="hidden px-3 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100"></div>' +
        '<div id="tl-client-chat-form" class="tl-chat-footer">' +
          '<input id="tl-client-chat-input" class="tl-chat-input" type="text" placeholder="Type a message..." autocomplete="off" />' +
          '<button type="button" id="tl-client-chat-send" class="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg text-sm">Send</button>' +
        '</div>';
      document.body.appendChild(panel);
    }

    var bodyEl = document.getElementById('tl-client-chat-body');
    var formEl = document.getElementById('tl-client-chat-form');
    var inputEl = document.getElementById('tl-client-chat-input');
    var subEl = document.getElementById('tl-client-chat-sub');
    var statusEl = document.getElementById('tl-client-chat-status');
    var pollTimer = null;
    var currentOrderId = null;
    var lastSig = '';

    function setStatus(msg) {
      if (!statusEl) return;
      if (msg) { statusEl.textContent = msg; statusEl.classList.remove('hidden'); }
      else { statusEl.textContent = ''; statusEl.classList.add('hidden'); }
    }

    function openChat(orderId) {
      // Read order id fresh each time; each order has its own separate conversation
      currentOrderId = String(orderId || '').trim();
      lastSig = '';
      setStatus('');
      if (subEl) subEl.textContent = currentOrderId ? ('Order ' + currentOrderId) : 'Select an order';
      if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">Loading messages...</p>';
      panel.classList.remove('tl-hidden');
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (!currentOrderId) {
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">Order ID is missing. Please open chat from an order.</p>';
        return;
      }
      loadMessages(currentOrderId, true);
      pollTimer = setInterval(function(){
        // use the current order id; stop if popup closed or order changed
        if (panel.classList.contains('tl-hidden') || !currentOrderId) return;
        loadMessages(currentOrderId, false);
        loadNotifications();
      }, POLL_MS);
      loadNotifications();
      setTimeout(function(){ if (inputEl) inputEl.focus(); }, 50);
    }
    function closeChat() {
      panel.classList.add('tl-hidden');
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      // clear current conversation state so next open starts fresh
      currentOrderId = null;
      lastSig = '';
      setStatus('');
      if (bodyEl) bodyEl.innerHTML = '';
    }
    function loadMessages(orderId, markRead) {
      var oid = String(orderId || currentOrderId || '').trim();
      if (!oid) {
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">Order ID is missing.</p>';
        return;
      }
      // ignore stale responses if the open order changed
      var path = '/api/messages?order_id=' + encodeURIComponent(oid);
      api(path).then(function(data){
        if (String(currentOrderId || '') !== oid || panel.classList.contains('tl-hidden')) return;
        var msgs = data.messages || [];
        var sig = oid + ':' + msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : 0);
        if (sig !== lastSig) {
          lastSig = sig;
          renderMessages(bodyEl, msgs, session.id);
        }
        var isOpen = panel && !panel.classList.contains('tl-hidden');
        if (markRead || isOpen) {
          api('/api/messages/read', { method: 'POST', body: { order_id: oid } }).catch(function(){});
        }
      }).catch(function(err){
        if (String(currentOrderId || '') !== oid) return;
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load messages.') + '</p>';
      });
    }

    document.getElementById('tl-client-chat-close').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} closeChat(); });
    function sendClientMessage() {
      setStatus('');
      var text = (inputEl.value || '').trim();
      var oid = String(currentOrderId || '').trim();
      if (!oid) { setStatus('Order ID is missing. Please open chat from an order.'); return; }
      if (!text) { setStatus('Message cannot be empty.'); return; }
      var submitBtn = document.getElementById('tl-client-chat-send');
      if (submitBtn) submitBtn.disabled = true;
      var payload = { message: text, order_id: oid };
      api('/api/messages', { method: 'POST', body: payload }).then(function(res){
        if (String(currentOrderId || '') !== oid) return;
        inputEl.value = '';
        setStatus('');
        var saved = res && res.message;
        if (saved) {
          var mine = String(saved.sender_id) === String(session.id);
          // replace "no messages" placeholder or append
          if (bodyEl && bodyEl.querySelector('p.text-gray-500')) bodyEl.innerHTML = '';
          if (bodyEl) {
            bodyEl.innerHTML += '<div class="tl-chat-msg ' + (mine ? 'me' : 'them') + '">' +
              esc(saved.message) + '<span class="tl-chat-time">' + esc(fmtTime(saved.created_at)) + '</span></div>';
            bodyEl.scrollTop = bodyEl.scrollHeight;
          }
          try { lastSig = oid + ':' + ((parseInt((lastSig || '').split(':')[1], 10) || 0) + 1) + ':' + saved.id; } catch(e) {}
        } else {
          loadMessages(oid, false);
        }
      }).catch(function(err){
        var msg = err && err.message ? err.message : 'Failed to send message.';
        setStatus(msg);
      }).then(function(){
        if (submitBtn) submitBtn.disabled = false;
        if (inputEl) inputEl.focus();
      });
    }
    document.getElementById('tl-client-chat-send').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} sendClientMessage(); });
    inputEl.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); sendClientMessage(); } });

    // ===== Notification bell (client navbar) =====
    var bellBtn = document.getElementById('tl-notif-bell');
    var bellBadge = document.getElementById('tl-notif-badge');
    var dropdown = document.getElementById('tl-notif-dropdown');
    var notifList = document.getElementById('tl-notif-list');
    var markAllBtn = document.getElementById('tl-notif-mark-all');
    var notifWrap = document.getElementById('tl-notif-wrap');
    var notifCache = [];

    function renderNotifications(list) {
      if (!notifList) return;
      if (!list || !list.length) {
        notifList.innerHTML = '<p class="px-4 py-6 text-sm text-gray-500 text-center">No new notifications</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        var unread = !n.read && !n.is_read;
        var orderLabel = n.order_id ? ('Order ' + n.order_id) : 'Message';
        var preview = String(n.message || '');
        if (preview.length > 70) preview = preview.slice(0, 67) + '...';
        html += '<button type="button" class="tl-notif-item w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ' + (unread ? 'bg-red-50/40' : 'bg-white') + '" data-id="' + esc(n.id) + '" data-order-id="' + esc(n.order_id || '') + '">' +
          '<div class="flex items-start justify-between gap-2"><p class="text-xs font-bold ' + (unread ? 'text-gray-900' : 'text-gray-700') + '">' + esc(orderLabel) + '</p><span class="text-[11px] text-gray-400 whitespace-nowrap">' + esc(timeAgo(n.created_at)) + '</span></div>' +
          '<p class="text-sm mt-1 ' + (unread ? 'font-semibold text-gray-900' : 'text-gray-600') + '">' + esc(preview) + '</p>' +
        '</button>';
      }
      notifList.innerHTML = html;
    }

    function updateBell(count) {
      if (!bellBadge) return;
      var n = Number(count || 0);
      if (n > 0) {
        bellBadge.textContent = n > 99 ? '99+' : String(n);
        bellBadge.classList.remove('hidden');
        bellBadge.style.display = 'inline-flex';
      } else {
        bellBadge.classList.add('hidden');
        bellBadge.style.display = '';
      }
    }

    function loadNotifications() {
      api('/api/notifications').then(function(d){
        notifCache = d.notifications || [];
        updateBell(d.unread_count || 0);
        if (dropdown && !dropdown.classList.contains('hidden')) renderNotifications(notifCache);
      }).catch(function(){});
    }

    function openDropdown() {
      if (!dropdown) return;
      dropdown.classList.remove('hidden');
      renderNotifications(notifCache);
      // refresh on open
      api('/api/notifications').then(function(d){
        notifCache = d.notifications || [];
        updateBell(d.unread_count || 0);
        renderNotifications(notifCache);
      }).catch(function(){});
    }
    function closeDropdown() { if (dropdown) dropdown.classList.add('hidden'); }

    if (bellBtn) bellBtn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if (!dropdown) return;
      if (dropdown.classList.contains('hidden')) openDropdown(); else closeDropdown();
    });

    if (markAllBtn) markAllBtn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      api('/api/notifications/read', { method: 'POST', body: { all: true } }).then(function(){
        loadNotifications();
      }).catch(function(){});
    });

    if (notifList) notifList.addEventListener('click', function(e){
      var item = e.target.closest && e.target.closest('.tl-notif-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      var id = item.getAttribute('data-id');
      var orderId = item.getAttribute('data-order-id') || '';
      api('/api/notifications/read', { method: 'POST', body: { id: id } }).then(function(){
        closeDropdown();
        openChat(orderId);
        loadNotifications();
      }).catch(function(){
        closeDropdown();
        openChat(orderId);
      });
    });

    document.addEventListener('click', function(e){
      if (!dropdown || dropdown.classList.contains('hidden')) return;
      if (notifWrap && notifWrap.contains(e.target)) return;
      closeDropdown();
    });

    // Check for new admin messages every 5 seconds without reloading
    loadNotifications();
    setInterval(loadNotifications, 5000);

    // Attach to "Message Admin" buttons on order rows (delegated) - read order id fresh each click
    document.addEventListener('click', function(e){
      var btn = e.target.closest ? e.target.closest('.tl-message-admin-btn') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var orderId = String(btn.getAttribute('data-order-id') || '').trim();
      openChat(orderId);
    });
  }

  // ===== Admin dashboard: Messages button + threads + chat =====
  function initAdminMessaging() {
    var session = getSession();
    if (!session || session.role !== 'admin') return;
    ensureChatStyles();

    var headerActions = document.querySelector('header .flex.items-center.gap-3');
    if (headerActions && !document.getElementById('tl-admin-messages-btn')) {
      var btn = document.createElement('button');
      btn.id = 'tl-admin-messages-btn';
      btn.type = 'button';
      btn.className = 'relative text-sm font-semibold text-gray-700 hover:text-red-600 transition-colors inline-flex items-center gap-1';
      btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-9 7l3.5-3.5H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h.5z"/></svg><span>Messages</span><span id="tl-admin-unread-badge" class="tl-msg-badge hidden">0</span>';
      headerActions.insertBefore(btn, headerActions.firstChild);
    }

    // Panel
    var panel = document.getElementById('tl-admin-chat');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tl-admin-chat';
      panel.className = 'tl-chat-panel tl-hidden';
      panel.style.width = '24rem';
      panel.style.height = '32rem';
      panel.innerHTML =
        '<div class="tl-chat-header">' +
          '<div><p id="tl-admin-chat-title" class="text-sm font-bold">Client Messages</p><p id="tl-admin-chat-sub" class="text-xs text-red-100">Select a conversation</p></div>' +
          '<button id="tl-admin-chat-close" class="text-white/80 hover:text-white" aria-label="Close"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div id="tl-admin-threads" class="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50"></div>' +
        '<div id="tl-admin-convo" class="hidden flex-1 flex flex-col min-h-0">' +
          '<div class="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between"><button id="tl-admin-back" class="text-sm font-semibold text-red-600 hover:text-red-700">&larr; Back</button><span id="tl-admin-convo-name" class="text-sm font-semibold text-gray-900"></span></div>' +
          '<div id="tl-admin-chat-body" class="tl-chat-body flex-1"></div>' +
          '<div id="tl-admin-chat-status" class="hidden px-3 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100"></div>' +
          '<div id="tl-admin-chat-form" class="tl-chat-footer">' +
            '<input id="tl-admin-chat-input" class="tl-chat-input" type="text" placeholder="Type a reply..." autocomplete="off" />' +
            '<button type="button" id="tl-admin-chat-send" class="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg text-sm">Send</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(panel);
    }

    var threadsEl = document.getElementById('tl-admin-threads');
    var convoEl = document.getElementById('tl-admin-convo');
    var bodyEl = document.getElementById('tl-admin-chat-body');
    var inputEl = document.getElementById('tl-admin-chat-input');
    var subEl = document.getElementById('tl-admin-chat-sub');
    var convoNameEl = document.getElementById('tl-admin-convo-name');
    var statusEl = document.getElementById('tl-admin-chat-status');
    var badge = document.getElementById('tl-admin-unread-badge');
    var pollTimer = null;
    var currentClient = null; // {id, name}
    var lastMsgSig = '';
    var usersCache = [];

    function setStatus(msg) {
      if (!statusEl) return;
      if (msg) { statusEl.textContent = msg; statusEl.classList.remove('hidden'); }
      else { statusEl.textContent = ''; statusEl.classList.add('hidden'); }
    }

    function loadUsersCache() {
      try { usersCache = JSON.parse(localStorage.getItem('torqueline_users') || '[]') || []; } catch(e){ usersCache = []; }
    }
    function nameFor(id) {
      for (var i = 0; i < usersCache.length; i++) if (usersCache[i].id === id) return usersCache[i].name || id;
      return id;
    }

    function showThreadsView() {
      currentClient = null;
      lastMsgSig = '';
      setStatus('');
      if (bodyEl) bodyEl.innerHTML = '';
      threadsEl.classList.remove('hidden');
      convoEl.classList.add('hidden');
      if (subEl) subEl.textContent = 'Select an order conversation';
      loadThreads();
    }
    function showConvoView(client) {
      // Separate conversation per (client, order)
      currentClient = { id: client.id, name: client.name, order_id: String(client.order_id || '').trim() };
      lastMsgSig = '';
      setStatus('');
      if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">Loading messages...</p>';
      threadsEl.classList.add('hidden');
      convoEl.classList.remove('hidden');
      convoEl.style.display = 'flex';
      var label = (client.name || client.id) + (currentClient.order_id ? ' · Order ' + currentClient.order_id : ' · (no order)');
      if (convoNameEl) convoNameEl.textContent = label;
      if (subEl) subEl.textContent = currentClient.order_id ? ('Order ' + currentClient.order_id) : 'No order';
      if (!currentClient.order_id) {
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">This conversation has no order. Old messages may need cleanup.</p>';
        return;
      }
      loadConversation(true);
    }

    function loadThreads() {
      loadUsersCache();
      api('/api/messages/threads').then(function(data){
        var threads = data.threads || [];
        if (!threads.length) {
          threadsEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No client messages yet.</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < threads.length; i++) {
          var t = threads[i];
          var name = nameFor(t.client_id);
          var unread = Number(t.unread_count || 0);
          var orderId = t.order_id ? String(t.order_id) : '';
          var orderLabel = orderId ? ('Order ' + orderId) : 'No order';
          html += '<button type="button" class="tl-thread" data-client-id="' + esc(t.client_id) + '" data-client-name="' + esc(name) + '" data-order-id="' + esc(orderId) + '">' +
            '<div class="flex items-start justify-between gap-2"><div><p class="font-semibold text-gray-900 text-sm">' + esc(name) + '</p><p class="text-[11px] font-semibold text-red-700 mt-0.5">' + esc(orderLabel) + '</p></div>' +
            (unread > 0 ? '<span class="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">' + unread + '</span>' : '') +
            '</div>' +
            '<p class="text-xs text-gray-600 mt-1 truncate">' + esc(t.last_message || '') + '</p>' +
            '<p class="text-[11px] text-gray-400 mt-1">' + esc(fmtTime(t.last_created_at)) + '</p>' +
            '</button>';
        }
        threadsEl.innerHTML = html;
      }).catch(function(err){
        threadsEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load messages.') + '</p>';
      });
    }

    function loadConversation(markRead) {
      if (!currentClient || !currentClient.order_id) return;
      var oid = currentClient.order_id;
      var cid = currentClient.id;
      api('/api/messages?client_id=' + encodeURIComponent(cid) + '&order_id=' + encodeURIComponent(oid)).then(function(data){
        // ignore stale response if admin switched to a different order/client
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        var msgs = data.messages || [];
        var sig = cid + ':' + oid + ':' + msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : 0);
        if (sig !== lastMsgSig) { lastMsgSig = sig; renderMessages(bodyEl, msgs, ADMIN_ID); }
        if (markRead) {
          api('/api/messages/read', { method: 'POST', body: { client_id: cid, order_id: oid } }).catch(function(){});
        }
      }).catch(function(err){
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load conversation.') + '</p>';
      });
    }

    function updateUnreadBadge() {
      api('/api/messages/unread').then(function(d){
        var n = Number(d.unread || 0);
        if (!badge) return;
        if (n > 0) { badge.textContent = n > 99 ? '99+' : String(n); badge.classList.remove('hidden'); badge.style.display = 'inline-flex'; }
        else { badge.classList.add('hidden'); badge.style.display = ''; }
      }).catch(function(){});
    }

    function openPanel() {
      panel.classList.remove('tl-hidden');
      showThreadsView();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function(){
        // use current selected client/order at poll time; stop when panel closed
        if (panel.classList.contains('tl-hidden')) return;
        if (currentClient && currentClient.order_id) loadConversation(false); else loadThreads();
        updateUnreadBadge();
      }, POLL_MS);
    }
    function closePanel() {
      panel.classList.add('tl-hidden');
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      // clear conversation state so next open starts fresh
      currentClient = null;
      lastMsgSig = '';
      setStatus('');
      if (bodyEl) bodyEl.innerHTML = '';
    }

    document.getElementById('tl-admin-messages-btn').addEventListener('click', function(e){ if(e){e.preventDefault();} openPanel(); });
    document.getElementById('tl-admin-chat-close').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} closePanel(); });
    document.getElementById('tl-admin-back').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} showThreadsView(); });

    threadsEl.addEventListener('click', function(e){
      var t = e.target.closest && e.target.closest('.tl-thread');
      if (!t) return;
      e.preventDefault();
      showConvoView({
        id: t.getAttribute('data-client-id'),
        name: t.getAttribute('data-client-name'),
        order_id: t.getAttribute('data-order-id') || ''
      });
    });

    function sendAdminReply() {
      setStatus('');
      if (!currentClient || !currentClient.id || !currentClient.order_id) {
        setStatus('Select a client order conversation first.');
        return;
      }
      var text = (inputEl.value || '').trim();
      if (!text) { setStatus('Reply cannot be empty.'); return; }
      var submitBtn = document.getElementById('tl-admin-chat-send');
      if (submitBtn) submitBtn.disabled = true;
      var cid = currentClient.id;
      var oid = currentClient.order_id;
      api('/api/messages', { method: 'POST', body: { client_id: cid, order_id: oid, message: text } }).then(function(res){
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        inputEl.value = '';
        setStatus('');
        var saved = res && res.message;
        if (saved) {
          var mine = String(saved.sender_id) === String(ADMIN_ID);
          if (bodyEl && bodyEl.querySelector('p.text-gray-500')) bodyEl.innerHTML = '';
          if (bodyEl) {
            bodyEl.innerHTML += '<div class="tl-chat-msg ' + (mine ? 'me' : 'them') + '">' +
              esc(saved.message) + '<span class="tl-chat-time">' + esc(fmtTime(saved.created_at)) + '</span></div>';
            bodyEl.scrollTop = bodyEl.scrollHeight;
          }
          try { lastMsgSig = cid + ':' + oid + ':' + ((parseInt((lastMsgSig || '').split(':')[2], 10) || 0) + 1) + ':' + saved.id; } catch(e) {}
        } else {
          loadConversation(false);
        }
      }).catch(function(err){
        var msg = err && err.message ? err.message : 'Failed to send reply.';
        setStatus(msg);
      }).then(function(){
        if (submitBtn) submitBtn.disabled = false;
        if (inputEl) inputEl.focus();
      });
    }
    document.getElementById('tl-admin-chat-send').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} sendAdminReply(); });
    inputEl.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); sendAdminReply(); } });

    // Global unread badge polling even when panel closed
    updateUnreadBadge();
    setInterval(updateUnreadBadge, POLL_MS);
  }

  function initMessaging() {
    try {
      var session = getSession();
      if (!session) return;
      if (session.role === 'admin') initAdminMessaging();
      else initClientMessaging();
    } catch (e) {
      try { console.error('Messaging init error', e); } catch (err) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMessaging);
  } else {
    initMessaging();
  }
})();
