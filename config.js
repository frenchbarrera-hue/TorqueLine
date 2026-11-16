// TorqueLine Frontend Configuration
const CONFIG = {
  // API base URL - empty string means same origin as frontend
  API_BASE_URL: '',

  // Polling interval for messages (ms)
  POLL_MS: 3000,

  // Admin user ID (matches server.py ADMIN_ID)
  ADMIN_ID: 'usr_admin',

  // App settings
  APP_NAME: 'TorqueLine',
  CURRENCY: 'PHP',
  LOCALE: 'en-PH',

  // Feature flags
  FEATURES: {
    CHAT: true,
    ORDER_TRACKING: true,
    PAYMENT: true,
    ADMIN_DASHBOARD: true
  },

  // UI settings
  UI: {
    TOAST_DURATION: 3000,
    MODAL_ANIMATION_MS: 200,
    DEBOUNCE_MS: 300
  }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.TORQUELINE_CONFIG = CONFIG;
}