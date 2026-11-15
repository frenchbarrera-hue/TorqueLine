(function() {
  var SESSION_KEY = 'torqueline_session';
  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  var session = loadSession();
  var path = (window.location.pathname || '').toLowerCase();
  var isAdminPage = path.indexOf('admin-dashboard') !== -1;
  var isUserPage = path.indexOf('user-dashboard') !== -1;

  if (!session) {
    window.location.replace('index.html');
    return;
  }
  if (isAdminPage && session.role !== 'admin') {
    window.location.replace('user-dashboard.html');
    return;
  }
  if (isUserPage && session.role === 'admin') {
    window.location.replace('admin-dashboard.html');
    return;
  }

  window.__DASHBOARD_SESSION__ = session;
  window.dashboardLogout = function() {
    try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
    window.location.href = 'index.html';
  };
})();