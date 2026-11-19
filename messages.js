(function() {
  var POLL_MS = (window.TORQUELINE_CONFIG && window.TORQUELINE_CONFIG.POLL_MS) || 3000;
  var ADMIN_ID = (window.TORQUELINE_CONFIG && window.TORQUELINE_CONFIG.ADMIN_ID) || 'usr_admin';
  var tlHiddenSet = {};
  var tlOpenDelmeMenu = null;

  function closeDelmeMenus(root) {
    var scope = root || document;
    var menus = scope.querySelectorAll('.tl-delme-menu');
    for (var i = 0; i < menus.length; i++) menus[i].style.display = 'none';
    tlOpenDelmeMenu = null;
  }

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

// Auto-detect API base: same origin as this page
  var API_BASE_URL = '';

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
      /* Message rows */
      '.tl-row{position:relative;margin-bottom:4px;display:flex;flex-direction:column;max-width:75%}' +
      '.tl-row.me{margin-left:auto;align-items:flex-end}' +
      '.tl-row.them{margin-right:auto;align-items:flex-start}' +
      '.tl-bubble{padding:.45rem .7rem;border-radius:1rem;font-size:.875rem;line-height:1.3;word-wrap:break-word;white-space:pre-wrap;position:relative}' +
      '.tl-row.me .tl-bubble{background:#dc2626;color:#fff;border-bottom-right-radius:.3rem}' +
      '.tl-row.them .tl-bubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:.3rem}' +
      '.tl-bubble.tl-gone{background:#f3f4f6;color:#9ca3af;font-style:italic;font-size:.8rem;border-radius:1rem}' +
      '.tl-img{max-width:100%;border-radius:.5rem;margin-bottom:.2rem;cursor:pointer;display:block}' +
      '.tl-t{display:none;font-size:.6rem;opacity:.5;margin-top:.1rem}' +
      '.tl-row:hover .tl-t{display:block}' +
      '.tl-ed{font-size:.6rem;opacity:.5;font-style:italic;margin-left:.2rem}' +
      '.tl-rx{display:flex;gap:.1rem;margin-top:.15rem;flex-wrap:wrap}' +
      '.tl-rx-b{font-size:.8rem;background:rgba(0,0,0,.06);padding:0 .25rem;border-radius:.6rem;line-height:1.3;cursor:pointer;animation:tl-bounce .3s ease}' +
      '.tl-row.me .tl-rx-b{background:rgba(255,255,255,.2)}' +
      /* Hover action buttons */
      '.tl-hover{position:absolute;top:-.6rem;right:0;display:flex;gap:.2rem;opacity:0;transition:opacity .12s;z-index:5}' +
      '.tl-row.them .tl-hover{left:0;right:auto}' +
      '.tl-row:hover .tl-hover{opacity:1}' +
      '.tl-hover button{background:#fff;border:1px solid #e5e7eb;border-radius:50%;width:1.5rem;height:1.5rem;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.8rem;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:0}' +
      '.tl-hover button:hover{background:#f3f4f6}' +
      /* Floating emoji picker (single, on body) */
      '.tl-fp{display:none;position:fixed;background:#fff;border:1px solid #e5e7eb;border-radius:2rem;padding:.35rem .5rem;gap:.1rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.15);animation:tl-pop .18s ease}' +
      '.tl-fp.show{display:flex}' +
      '@keyframes tl-pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}' +
      '.tl-fp-b{background:none;border:none;font-size:1.15rem;cursor:pointer;padding:.15rem;border-radius:.3rem;line-height:1}' +
      '.tl-fp-b:hover{background:#f3f4f6}' +
      /* Three dots menu */
      '.tl-menu{display:none;position:absolute;top:1.2rem;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:.5rem;padding:.2rem;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,.12);min-width:6.5rem;animation:tl-fade .15s ease}' +
      '.tl-row.them .tl-menu{left:0;right:auto}' +
      '.tl-menu.show{display:block}' +
      '@keyframes tl-fade{0%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:translateY(0)}}' +
      '@keyframes tl-bounce{0%{transform:scale(.7)}50%{transform:scale(1.15)}100%{transform:scale(1)}}' +
      '.tl-menu button{display:block;width:100%;text-align:left;padding:.35rem .55rem;border:none;background:none;border-radius:.25rem;font-size:.8rem;cursor:pointer;color:#374151}' +
      '.tl-menu button:hover{background:#f3f4f6}' +
      '.tl-menu .tl-m-del{color:#dc2626}' +
      '.tl-menu .tl-m-del:hover{background:#fef2f2}' +
      /* Inline edit */
      '.tl-edit{display:none;gap:.25rem;align-items:center;width:100%;animation:tl-fade .15s ease}' +
      '.tl-edit.show{display:flex}' +
      '.tl-edit-in{flex:1;border:1px solid #d1d5db;border-radius:.5rem;padding:.3rem .5rem;font-size:.85rem;outline:none;min-width:0}' +
      '.tl-edit-in:focus{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.15)}' +
      '.tl-edit-ok,.tl-edit-no{padding:.25rem .5rem;border-radius:.4rem;font-size:.75rem;font-weight:600;cursor:pointer;border:none}' +
      '.tl-edit-ok{background:#dc2626;color:#fff}' +
      '.tl-edit-ok:hover{background:#b91c1c}' +
      '.tl-edit-no{background:#f3f4f6;color:#374151}' +
      '.tl-edit-no:hover{background:#e5e7eb}' +
      '@media (hover:none){.tl-hover{opacity:1}}' +
      /* Delete-for-me dropdown on removed messages */
      '.tl-delme-btn{background:#fff;border:1px solid #e5e7eb;border-radius:50%;width:1.5rem;height:1.5rem;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.8rem;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:0;flex-shrink:0}' +
      '.tl-delme-btn:hover{background:#f3f4f6}' +
      '.tl-delme-menu{display:none;position:absolute;top:1.2rem;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:.5rem;padding:.2rem;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,.12);min-width:6.5rem;animation:tl-fade .15s ease}' +
      '.tl-row.them .tl-delme-menu{left:0;right:auto}' +
      '.tl-delme-menu button{display:block;width:100%;text-align:left;padding:.35rem .55rem;border:none;background:none;border-radius:.25rem;font-size:.8rem;cursor:pointer;color:#dc2626;font-family:inherit}' +
      '.tl-delme-menu button:hover{background:#fef2f2}' +
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
      var deleted = m.deleted_at ? true : false;
      var edited = m.edited_at ? true : false;
      var hasImage = m.image_url ? true : false;
      var reactions = Array.isArray(m.reactions) ? m.reactions : [];
      var deletedFor = Array.isArray(m.deleted_for) ? m.deleted_for : [];
      var myId = String(myId);
      var hiddenForMe = deletedFor.indexOf(myId) !== -1 || !!tlHiddenSet[String(m.id)];

      if (hiddenForMe) continue;

      if ((deleted && !hasImage)) {
        var goneLabel = 'This message was removed';
        html += '<div class="tl-row ' + (mine ? 'me' : 'them') + '" data-id="' + m.id + '" style="margin-bottom:4px">' +
          '<div class="tl-bubble" style="background:' + (mine ? '#dc2626' : '#f3f4f6') + ';padding:.45rem .7rem;border-radius:1rem">' +
            '<span style="color:#9ca3af;font-style:italic;font-size:.8rem">' + esc(goneLabel) + '</span>' +
          '</div>' +
          '<div class="tl-hover" style="opacity:1">' +
            '<button type="button" class="tl-delme-btn" data-id="' + m.id + '">⋯</button>' +
          '</div>' +
          '<div class="tl-delme-menu" data-id="' + m.id + '">' +
            '<button type="button" class="tl-delme-confirm" data-id="' + m.id + '">Delete for me</button>' +
          '</div>' +
        '</div>';
        continue;
      }

      html += '<div class="tl-row ' + (mine ? 'me' : 'them') + '" data-id="' + m.id + '">' +
        '<div class="tl-bubble">' +
          (hasImage ? '<img src="' + esc(m.image_url) + '" class="tl-img" onclick="window.open(this.src)" />' : '') +
          '<span>' + esc(m.message || '') + '</span>' +
          (edited ? '<span class="tl-ed">(edited)</span>' : '') +
          '<span class="tl-t">' + esc(fmtTime(m.created_at)) + '</span>' +
          (reactions.length ? '<div class="tl-rx">' +
            reactions.map(function(r){ return '<span class="tl-rx-b">' + r.emoji + '</span>'; }).join('') +
            '</div>' : '') +
        '</div>' +
        (deleted ? '' :
          '<div class="tl-hover">' +
            '<button class="tl-react" data-id="' + m.id + '">😊</button>' +
            '<button class="tl-more" data-id="' + m.id + '">⋯</button>' +
          '</div>') +
        (deleted ? '' :
          '<div class="tl-menu" data-id="' + m.id + '">' +
            (mine ? '<button class="tl-m-edit" data-id="' + m.id + '">Edit</button>' : '') +
            (mine ? '<button class="tl-m-del" data-id="' + m.id + '">Unsend</button>' : '') +
            '<button class="tl-m-delme" data-id="' + m.id + '">Delete for me</button>' +
          '</div>' +
          (mine ?
            '<div class="tl-edit" data-id="' + m.id + '">' +
              '<input type="text" class="tl-edit-in" value="' + esc(m.message || '').replace(/"/g, '&quot;') + '" />' +
              '<button class="tl-edit-ok" data-id="' + m.id + '">Save</button>' +
              '<button class="tl-edit-no" data-id="' + m.id + '">Cancel</button>' +
            '</div>' : '')) +
        '</div>';
    }
    container.innerHTML = html;

    // Animate new messages sliding up
    var rows = container.querySelectorAll('.tl-row');
    rows.forEach(function(row, idx) {
      if (idx >= rows.length - 3) {
        row.style.opacity = '0';
        row.style.transform = 'translateY(8px)';
        setTimeout(function() {
          row.style.transition = 'opacity .2s ease, transform .2s ease';
          row.style.opacity = '1';
          row.style.transform = 'translateY(0)';
        }, 10);
      }
    });
    container.scrollTop = container.scrollHeight;

    // Single floating emoji picker (created once, reused)
    var picker = document.getElementById('tl-float-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'tl-float-picker';
      picker.className = 'tl-fp';
      picker.innerHTML = ['👍','❤️','😂','😮','😢','🔥','🙏','👏'].map(function(e){
        return '<button class="tl-fp-b" data-emoji="' + e + '">' + e + '</button>';
      }).join('');
      document.body.appendChild(picker);

      // Close picker on outside click (added ONCE, not every render)
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.tl-fp') && !e.target.closest('.tl-react')) {
          picker.classList.remove('show');
        }
      });

      // Emoji click - toggle reaction (added ONCE, not every render)
      picker.querySelectorAll('.tl-fp-b').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          var emoji = this.getAttribute('data-emoji');
          var msgId = picker.getAttribute('data-msg');
          picker.classList.remove('show');
          if (msgId) {
            window.SUPABASE_CHAT.toggleReaction(msgId, emoji).then(function() {
              // Reset signature so the next refresh re-renders (reactions aren't in the signature)
              if (window.__TL_RESET_SIG__) window.__TL_RESET_SIG__();
              if (window.__TL_REFRESH__) window.__TL_REFRESH__();
            }).catch(function(err) {
              console.error('Reaction failed:', err);
            });
          }
        });
      });
    }

    // Smiley click - show floating picker
    container.querySelectorAll('.tl-react').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var id = this.getAttribute('data-id');
        var wasOpen = picker.classList.contains('show') && picker.getAttribute('data-msg') === id;
        if (wasOpen) { picker.classList.remove('show'); return; }
        picker.setAttribute('data-msg', id);
        var rect = this.getBoundingClientRect();
        var pickerWidth = 240;
        var left = rect.left - (pickerWidth / 2) + 12;
        if (left < 8) left = 8;
        if (left + pickerWidth > window.innerWidth) left = window.innerWidth - pickerWidth - 8;
        picker.style.left = left + 'px';
        picker.style.top = (rect.top - 48) + 'px';
        picker.classList.add('show');
      });
    });

    // More button (3 dots) - works for both .tl-more and .tl-more-inline
    container.querySelectorAll('.tl-more, .tl-more-inline').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var id = this.getAttribute('data-id');
        var row = container.querySelector('.tl-row[data-id="' + id + '"]');
        if (!row) return;
        var menu = row.querySelector('.tl-menu');
        var wasOpen = menu.classList.contains('show');
        container.querySelectorAll('.tl-menu.show').forEach(function(m){ m.classList.remove('show'); });
        if (!wasOpen) menu.classList.add('show');
      });
    });

    // Edit from menu
    container.querySelectorAll('.tl-m-edit').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var id = this.getAttribute('data-id');
        var row = container.querySelector('.tl-row[data-id="' + id + '"]');
        if (!row) return;
        row.querySelector('.tl-menu').classList.remove('show');
        var bubble = row.querySelector('.tl-bubble');
        var form = row.querySelector('.tl-edit');
        bubble.style.display = 'none';
        form.classList.add('show');
        var input = form.querySelector('.tl-edit-in');
        input.focus();
        input.select();
      });
    });

    // Save edit
    container.querySelectorAll('.tl-edit-ok').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var id = this.getAttribute('data-id');
        var form = this.closest('.tl-edit');
        var text = form.querySelector('.tl-edit-in').value.trim();
        if (!text) return;
        window.SUPABASE_CHAT.editMessage(id, text).then(function() {
          if (window.__TL_RESET_SIG__) window.__TL_RESET_SIG__();
          if (window.__TL_REFRESH__) window.__TL_REFRESH__();
        }).catch(function(err) {
          console.error('Edit failed:', err);
          alert('Failed to edit message. Make sure you ran supabase_setup.sql in Supabase.');
        });
      });
    });

    // Cancel edit
    container.querySelectorAll('.tl-edit-no').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var row = this.closest('.tl-row');
        row.querySelector('.tl-edit').classList.remove('show');
        row.querySelector('.tl-bubble').style.display = '';
      });
    });

    // Delete
    container.querySelectorAll('.tl-m-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (!confirm('Are you sure?')) return;
        var id = this.getAttribute('data-id');
        var row = container.querySelector('.tl-row[data-id="' + id + '"]');
        if (!row) return;
        row.querySelector('.tl-menu').classList.remove('show');
        // Fade out animation before deleting
        var bubble = row.querySelector('.tl-bubble');
        bubble.style.transition = 'opacity .3s ease, transform .3s ease';
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(.95)';
        setTimeout(function() {
          window.SUPABASE_CHAT.deleteMessage(id).then(function() {
            if (window.__TL_RESET_SIG__) window.__TL_RESET_SIG__();
            if (window.__TL_REFRESH__) window.__TL_REFRESH__();
          }).catch(function(err) {
            console.error('Delete failed:', err);
            alert('Failed to delete message. Make sure you ran supabase_setup.sql in Supabase.');
            bubble.style.opacity = '1';
            bubble.style.transform = 'scale(1)';
          });
        }, 300);
      });
    });

    // Delegated handler for all delete-for-me and menu toggle (survives innerHTML re-renders)
    if (!container.__tlDelmeDelegated) {
      container.__tlDelmeDelegated = true;
      container.addEventListener('click', function(e) {
        // Confirm delete for me on removed message
        var confirmBtn = e.target.closest('.tl-delme-confirm');
        if (confirmBtn) {
          e.preventDefault();
          e.stopPropagation();
          var id = confirmBtn.getAttribute('data-id');
          tlHiddenSet[String(id)] = true;
          closeDelmeMenus(container);
          container.querySelectorAll('.tl-row[data-id="' + id + '"]').forEach(function(r) {
            if (r.parentNode) r.parentNode.removeChild(r);
          });
          window.SUPABASE_CHAT.deleteForMe(id).then(function() {
            if (window.__TL_RESET_SIG__) window.__TL_RESET_SIG__();
            if (window.__TL_REFRESH__) window.__TL_REFRESH__();
          }).catch(function(err) {
            console.error('Delete for me failed:', err);
            if (window.__TL_STATUS__) window.__TL_STATUS__('Delete for me failed: ' + (err.message || err));
          });
          return;
        }

        // Toggle menu on removed message 3-dots
        var toggleBtn = e.target.closest('.tl-delme-btn');
        if (toggleBtn) {
          e.preventDefault();
          e.stopPropagation();
          var id = toggleBtn.getAttribute('data-id');
          var menu = container.querySelector('.tl-delme-menu[data-id="' + id + '"]');
          if (!menu) return;
          var wasOpen = (menu === tlOpenDelmeMenu);
          closeDelmeMenus(container);
          if (!wasOpen) {
            menu.style.display = 'block';
            tlOpenDelmeMenu = menu;
          }
          return;
        }

// Delete for me from 3-dots menu on normal messages
        var delmeBtn = e.target.closest('.tl-m-delme');
        if (delmeBtn) {
          e.preventDefault();
          e.stopPropagation();
          var id = delmeBtn.getAttribute('data-id');
          tlHiddenSet[String(id)] = true;
          container.querySelectorAll('.tl-row[data-id="' + id + '"]').forEach(function(r) {
            var menu = r.querySelector('.tl-menu');
            if (menu) menu.classList.remove('show');
            if (r.parentNode) r.parentNode.removeChild(r);
          });
          window.SUPABASE_CHAT.deleteForMe(id).then(function() {
            if (window.__TL_RESET_SIG__) window.__TL_RESET_SIG__();
            if (window.__TL_REFRESH__) window.__TL_REFRESH__();
          }).catch(function(err) {
            console.error('Delete for me failed:', err);
            if (window.__TL_STATUS__) window.__TL_STATUS__('Delete for me failed: ' + (err.message || err));
          });
          return;
        }
      });
    }

    // Close dropdown on outside click / Escape (registered once per container)
    if (!container.__tlDelmeCloseBound) {
      container.__tlDelmeCloseBound = true;
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.tl-delme-btn') && !e.target.closest('.tl-delme-menu')) {
          closeDelmeMenus(container);
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeDelmeMenus(container);
        }
      });
    }
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
          '<label for="tl-client-chat-img" style="cursor:pointer;font-size:1.2rem" title="Attach image">📎</label><input id="tl-client-chat-img" type="file" accept="image/*" style="display:none" />' +
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
    window.__TL_RESET_SIG__ = function() { lastSig = ''; };
    window.__TL_STATUS__ = function(msg) { setStatus(msg); };
    window.__TL_REFRESH__ = function() {
      if (currentOrderId) loadMessages(currentOrderId, false);
    };

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
      var sb = window.SUPABASE_CHAT;
      sb.getMessages(oid).then(function(data){
        if (String(currentOrderId || '') !== oid || panel.classList.contains('tl-hidden')) return;
        var msgs = (data.messages || []);
        // Populate tlHiddenSet from DB deleted_for so hidden messages stay hidden
        for (var k = 0; k < msgs.length; k++) {
          var df = Array.isArray(msgs[k].deleted_for) ? msgs[k].deleted_for : [];
          if (df.indexOf(String(session.id)) !== -1) tlHiddenSet[String(msgs[k].id)] = true;
        }
        msgs = msgs.filter(function(m){ return !tlHiddenSet[String(m.id)]; });
        var sig = oid + ':' + msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : 0);
        if (sig !== lastSig) {
          lastSig = sig;
          renderMessages(bodyEl, msgs, session.id);
        }
        var isOpen = panel && !panel.classList.contains('tl-hidden');
        if (markRead || isOpen) {
          sb.markRead(oid).then(function(){
            loadNotifications();
          }).catch(function(){});
        }
      }).catch(function(err){
        if (String(currentOrderId || '') !== oid) return;
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load messages.') + '</p>';
      });
    }

    document.getElementById('tl-client-chat-close').addEventListener('click', function(e){ if(e){e.preventDefault();e.stopPropagation();} closeChat(); });

    var pendingImage = null;
    var imgInput = document.getElementById('tl-client-chat-img');
    if (imgInput) {
      imgInput.addEventListener('change', function() {
        var file = this.files[0];
        if (!file) { pendingImage = null; return; }
        if (file.size > 5 * 1024 * 1024) { setStatus('Image too large (max 5MB)'); return; }
        pendingImage = file;
        inputEl.placeholder = 'Image attached - type caption or tap Send';
        inputEl.focus();
      });
    }

    function sendClientMessage() {
      setStatus('');
      var text = (inputEl.value || '').trim();
      var oid = String(currentOrderId || '').trim();
      if (!oid) { setStatus('Order ID is missing. Please open chat from an order.'); return; }
      if (!text && !pendingImage) { setStatus('Message cannot be empty.'); return; }
      var submitBtn = document.getElementById('tl-client-chat-send');
      if (submitBtn) submitBtn.disabled = true;
      var payload = { message: text, order_id: oid };
      var send = pendingImage
        ? window.SUPABASE_CHAT.uploadImage(pendingImage).then(function(r) { payload.image_url = r.url; return window.SUPABASE_CHAT.sendMessage(payload); })
        : window.SUPABASE_CHAT.sendMessage(payload);
      send.then(function(res){
        if (String(currentOrderId || '') !== oid) return;
        inputEl.value = '';
        pendingImage = null;
        if (imgInput) imgInput.value = '';
        inputEl.placeholder = 'Type a message...';
        setStatus('');
        lastSig = '';
        loadMessages(oid, false);
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
      window.SUPABASE_CHAT.getNotifications().then(function(d){
        notifCache = d.notifications || [];
        updateBell(d.notifications ? d.notifications.length : 0);
        if (dropdown && !dropdown.classList.contains('hidden')) renderNotifications(notifCache);
      }).catch(function(){});
    }

    function openDropdown() {
      if (!dropdown) return;
      dropdown.classList.remove('hidden');
      renderNotifications(notifCache);
      // refresh on open
      window.SUPABASE_CHAT.getNotifications().then(function(d){
        notifCache = d.notifications || [];
        updateBell(d.notifications ? d.notifications.length : 0);
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
      window.SUPABASE_CHAT.markAllRead().then(function(){
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
      window.SUPABASE_CHAT.markOneRead(id).then(function(){
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
            '<label for="tl-admin-chat-img" style="cursor:pointer;font-size:1.2rem" title="Attach image">📎</label><input id="tl-admin-chat-img" type="file" accept="image/*" style="display:none" />' +
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
      closeDelmeMenus(bodyEl);
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
      window.SUPABASE_CHAT.getThreads().then(function(data){
        var threads = data.threads || [];
        // Also fetch orders so new orders without messages appear as threads
        window.SUPABASE_CHAT.getOrders().then(function(oData){
          var orders = oData.orders || [];
          // Build a set of order_ids that already have message threads
          var orderThreadIds = {};
          for (var i = 0; i < threads.length; i++) {
            if (threads[i].order_id) orderThreadIds[String(threads[i].order_id)] = true;
          }
          // Add orders that don't yet have a message thread
          for (var j = 0; j < orders.length; j++) {
            var o = orders[j];
            var oid = String(o.id || o.order_number || '');
            if (!oid || orderThreadIds[oid]) continue;
            threads.push({
              client_id: o.user_id || 'unknown',
              order_id: oid,
              last_message: 'New order - PHP ' + (o.total_php || 0) + ' · ' + (o.status || 'pending'),
              last_created_at: o.placed_at || null,
              last_sender_role: 'client',
              unread_count: 0,
              isOrderOnly: true
            });
          }
          renderThreads(threads);
        }).catch(function(err){
          // If orders fetch fails, still render message threads
          renderThreads(threads);
        });
      }).catch(function(err){
        threadsEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load messages.') + '</p>';
      });
    }

    function renderThreads(threads) {
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
        var badgeClass = t.isOrderOnly ? 'bg-gray-500' : 'bg-red-600';
        html += '<button type="button" class="tl-thread" data-client-id="' + esc(t.client_id) + '" data-client-name="' + esc(name) + '" data-order-id="' + esc(orderId) + '">' +
          '<div class="flex items-start justify-between gap-2"><div><p class="font-semibold text-gray-900 text-sm">' + esc(name) + '</p><p class="text-[11px] font-semibold ' + (t.isOrderOnly ? 'text-gray-700' : 'text-red-700') + ' mt-0.5">' + esc(orderLabel) + '</p></div>' +
          (unread > 0 ? '<span class="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">' + unread + '</span>' : '') +
          '</div>' +
          '<p class="text-xs text-gray-600 mt-1 truncate">' + esc(t.last_message || '') + '</p>' +
          '<p class="text-[11px] text-gray-400 mt-1">' + esc(fmtTime(t.last_created_at)) + '</p>' +
          '</button>';
      }
      threadsEl.innerHTML = html;
    }

    function loadConversation(markRead) {
      if (!currentClient || !currentClient.order_id) return;
      var oid = currentClient.order_id;
      var cid = currentClient.id;
      window.SUPABASE_CHAT.getMessages(oid, cid).then(function(data){
        // ignore stale response if admin switched to a different order/client
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        var msgs = (data.messages || []);
        // Populate tlHiddenSet from DB deleted_for so hidden messages stay hidden
        for (var k = 0; k < msgs.length; k++) {
          var df = Array.isArray(msgs[k].deleted_for) ? msgs[k].deleted_for : [];
          if (df.indexOf(ADMIN_ID) !== -1) tlHiddenSet[String(msgs[k].id)] = true;
        }
        msgs = msgs.filter(function(m){ return !tlHiddenSet[String(m.id)]; });
        var sig = cid + ':' + oid + ':' + msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : 0);
        if (sig !== lastMsgSig) { lastMsgSig = sig; renderMessages(bodyEl, msgs, ADMIN_ID); }
        if (markRead) {
          window.SUPABASE_CHAT.markRead(oid, cid).then(function(){
            updateUnreadBadge();
          }).catch(function(){});
        }
      }).catch(function(err){
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        if (bodyEl) bodyEl.innerHTML = '<p class="text-sm text-red-600 text-center py-8">' + esc(err && err.message ? err.message : 'Unable to load conversation.') + '</p>';
      });
    }

    function updateUnreadBadge() {
      window.SUPABASE_CHAT.getAdminUnread().then(function(d){
        var n = Number(d.total || 0);
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
      closeDelmeMenus(bodyEl);
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

    var pendingImage = null;
    var imgInput = document.getElementById('tl-admin-chat-img');
    if (imgInput) {
      imgInput.addEventListener('change', function() {
        var file = this.files[0];
        if (!file) { pendingImage = null; return; }
        if (file.size > 5 * 1024 * 1024) { setStatus('Image too large (max 5MB)'); return; }
        pendingImage = file;
        inputEl.placeholder = 'Image attached - type caption or tap Send';
        inputEl.focus();
      });
    }

    // Refresh hook for edit/delete/reaction
    window.__TL_RESET_SIG__ = function() { lastMsgSig = ''; };
    window.__TL_STATUS__ = function(msg) { setStatus(msg); };
    window.__TL_REFRESH__ = function() {
      if (currentClient && currentClient.order_id) loadConversation(false);
    };

    function sendAdminReply() {
      setStatus('');
      if (!currentClient || !currentClient.id || !currentClient.order_id) {
        setStatus('Select a client order conversation first.');
        return;
      }
      var text = (inputEl.value || '').trim();
      if (!text && !pendingImage) { setStatus('Reply cannot be empty.'); return; }
      var submitBtn = document.getElementById('tl-admin-chat-send');
      if (submitBtn) submitBtn.disabled = true;
      var cid = currentClient.id;
      var oid = currentClient.order_id;
      var payload = { client_id: cid, order_id: oid, message: text };
      var send = pendingImage
        ? window.SUPABASE_CHAT.uploadImage(pendingImage).then(function(r) { payload.image_url = r.url; return window.SUPABASE_CHAT.sendMessage(payload); })
        : window.SUPABASE_CHAT.sendMessage(payload);
      send.then(function(res){
        if (!currentClient || currentClient.id !== cid || currentClient.order_id !== oid) return;
        inputEl.value = '';
        pendingImage = null;
        if (imgInput) imgInput.value = '';
        inputEl.placeholder = 'Type a reply...';
        setStatus('');
        lastMsgSig = '';
        loadConversation(false);
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
