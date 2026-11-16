/* TorqueLine Supabase data layer - replaces server.py API calls */
(function() {
  var CFG = window.TORQUELINE_CONFIG || {};
  var SB_URL = (CFG.SUPABASE_URL || '').replace(/\/$/, '');
  var SB_KEY = CFG.SUPABASE_ANON_KEY || '';
  var ADMIN_ID = CFG.ADMIN_ID || 'usr_admin';

  function session() {
    if (window.__DASHBOARD_SESSION__) return window.__DASHBOARD_SESSION__;
    try {
      var raw = localStorage.getItem('torqueline_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function headers(extra) {
    var h = {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }

  function req(method, path, body, prefer) {
    var opts = {
      method: method,
      headers: headers()
    };
    if (prefer) opts.headers['Prefer'] = prefer;
    if (body) opts.body = JSON.stringify(body);
    return fetch(SB_URL + '/rest/v1' + path, opts).then(function(res) {
      if (!res.ok) return res.text().then(function(t) { throw new Error('Supabase ' + res.status + ': ' + t); });
      if (res.status === 204) return null;
      return res.json();
    });
  }

  // GET messages for a conversation (client or admin)
  function getMessages(orderId, clientId) {
    var s = session();
    var path = '/messages?order_id=eq.' + encodeURIComponent(orderId);
    if (clientId && s && s.role === 'admin') {
      // Admin conversation: messages between this client and admin (either direction)
      path += '&sender_id=eq.' + encodeURIComponent(clientId);
      // Need both directions: client→admin and admin→client
      // PostgREST doesn't support OR in query params, so fetch by receiver_id=admin
      // and merge with sender_id=client results
    }
    path += '&order=created_at.asc&limit=200';
    return req('GET', path).then(function(rows) {
      var msgs = rows || [];
      // For admin: also fetch messages sent BY admin TO this client
      if (clientId && s && s.role === 'admin') {
        var adminPath = '/messages?order_id=eq.' + encodeURIComponent(orderId) +
          '&sender_id=eq.' + encodeURIComponent(ADMIN_ID) +
          '&receiver_id=eq.' + encodeURIComponent(clientId) +
          '&order=created_at.asc&limit=200';
        return req('GET', adminPath).then(function(adminRows) {
          // Merge and sort by created_at
          var merged = msgs.concat(adminRows || []);
          merged.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
          return { messages: merged };
        });
      }
      return { messages: msgs };
    });
  }

  // POST a message
  function sendMessage(payload) {
    var s = session();
    var body;
    if (s.role === 'admin') {
      body = {
        order_id: payload.order_id,
        sender_id: ADMIN_ID,
        receiver_id: payload.client_id,
        sender_role: 'admin',
        message: payload.message
      };
    } else {
      body = {
        order_id: payload.order_id,
        sender_id: String(s.id),
        receiver_id: ADMIN_ID,
        sender_role: 'client',
        message: payload.message
      };
    }
    return req('POST', '/messages', body, 'return=representation').then(function(rows) {
      return { message: rows && rows[0] };
    });
  }

  // Mark messages as read
  function markRead(orderId, clientId) {
    var s = session();
    var path = '/messages?order_id=eq.' + encodeURIComponent(orderId) + '&is_read=eq.0';
    if (s.role === 'client') {
      path += '&receiver_id=eq.' + encodeURIComponent(String(s.id));
    } else if (clientId) {
      path += '&sender_id=eq.' + encodeURIComponent(clientId);
    }
    return req('PATCH', path, { is_read: 1 }, 'return=representation').then(function(rows) {
      return { updated: rows ? rows.length : 0 };
    });
  }

  // GET unread count (client)
  function getUnread() {
    var s = session();
    var path = '/messages?receiver_id=eq.' + encodeURIComponent(String(s.id)) + '&is_read=eq.0&select=id';
    return req('GET', path).then(function(rows) {
      return { unread: rows ? rows.length : 0 };
    });
  }

  // GET notifications (unread messages)
  function getNotifications() {
    var s = session();
    var path = '/messages?receiver_id=eq.' + encodeURIComponent(String(s.id)) + '&is_read=eq.0&order=created_at.desc&limit=50';
    return req('GET', path).then(function(rows) {
      return { notifications: (rows || []).map(function(m) {
        return { id: m.id, message: m.message, order_id: m.order_id, sender_id: m.sender_id, created_at: m.created_at };
      })};
    });
  }

  // Mark all notifications as read
  function markAllRead() {
    var s = session();
    var path = '/messages?receiver_id=eq.' + encodeURIComponent(String(s.id)) + '&is_read=eq.0';
    return req('PATCH', path, { is_read: 1 }, 'return=representation').then(function(rows) {
      return { updated: rows ? rows.length : 0 };
    });
  }

  // Mark single notification as read
  function markOneRead(id) {
    var path = '/messages?id=eq.' + encodeURIComponent(id);
    return req('PATCH', path, { is_read: 1 }, 'return=representation').then(function(rows) {
      return { updated: rows ? rows.length : 0 };
    });
  }

  // GET threads (admin) - all client conversations
  function getThreads() {
    var path = '/rpc/get_threads';
    return req('POST', path, {}, 'return=representation').catch(function() {
      // Fallback: fetch all messages and group client-side
      return req('GET', '/messages?order=created_at.desc&limit=500').then(function(rows) {
        var map = {};
        (rows || []).forEach(function(m) {
          var key = m.sender_id + '|' + (m.order_id || '');
          if (!map[key] || new Date(m.created_at) > new Date(map[key].created_at)) {
            map[key] = m;
          }
        });
        var threads = Object.keys(map).map(function(k) {
          var m = map[k];
          return {
            client_id: m.sender_id === ADMIN_ID ? m.receiver_id : m.sender_id,
            order_id: m.order_id,
            last_message: m.message,
            last_created_at: m.created_at,
            last_sender_role: m.sender_role,
            unread_count: 0
          };
        });
        return { threads: threads };
      });
    });
  }

  // GET admin unread count
  function getAdminUnread() {
    var path = '/messages?receiver_id=eq.' + encodeURIComponent(ADMIN_ID) + '&is_read=eq.0&select=id';
    return req('GET', path).then(function(rows) {
      var count = rows ? rows.length : 0;
      return { total: count, per_conversation: {} };
    });
  }

  // Public API - matches the old api() interface
  window.SUPABASE_CHAT = {
    getMessages: getMessages,
    sendMessage: sendMessage,
    markRead: markRead,
    getUnread: getUnread,
    getNotifications: getNotifications,
    markAllRead: markAllRead,
    markOneRead: markOneRead,
    getThreads: getThreads,
    getAdminUnread: getAdminUnread
  };
})();