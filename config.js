// TorqueLine Frontend Configuration
const CONFIG = {
  // Supabase project URL (from Supabase dashboard → Settings → API)
  SUPABASE_URL: 'https://xolcoywvyonoueqbfxea.supabase.co',

  // Supabase anon/public key (from Supabase dashboard → Settings → API → anon public)
  // Paste your key here:
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbGNveXd2eW9ub3VlcWJmeGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MzAwODQsImV4cCI6MjExMDQwNjA4NH0.k_0Ba6BjvX4WYtzIInGsmB8EHZxGNRAcluD4pWV4qNw',

  // Polling interval for messages (ms)
  POLL_MS: 3000,

  // Admin user ID (matches server.py ADMIN_ID and Supabase messages.sender_id)
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