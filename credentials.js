// Shared credential manager. Loaded synchronously on every page before sync.js / topbar.js.
// New users: run setup.html to populate localStorage.
// Existing user: auto-migrated on first load via the migration block below.
(function () {
  'use strict';

  // One-time migration: if the user already has dashboard data but hasn't been through
  // the new setup wizard, seed their localStorage with the original project credentials
  // so nothing breaks after the upgrade.
  (function migrate() {
    if (localStorage.getItem('user_supabase_url')) return; // already configured
    var hasData = localStorage.getItem('po_coach_v1') || localStorage.getItem('po_water_v1');
    if (!hasData) return; // brand-new user — let setup.html handle it
    localStorage.setItem('user_supabase_url', 'https://mzhplwybcfppobsqwcmm.supabase.co');
    localStorage.setItem('user_supabase_key', 'sb_publishable__ZwmxLQdrUIvTa6Y0zhDbw_2IXYke33');
  })();

  window.AppConfig = {
    // Return a live Supabase client using stored credentials, or null if not configured.
    getSupabase: function () {
      var url = localStorage.getItem('user_supabase_url');
      var key = localStorage.getItem('user_supabase_key');
      if (!url || !key || !window.supabase) return null;
      return window.supabase.createClient(url, key);
    },

    // Return the stored Anthropic API key, or '' if not set.
    getAnthropicKey: function () {
      return localStorage.getItem('user_anthropic_key') || '';
    },

    // Return the user's display name, or 'You' if not set.
    getDisplayName: function () {
      return localStorage.getItem('user_display_name') || 'You';
    },

    // True if Supabase credentials exist.
    isConfigured: function () {
      return !!(localStorage.getItem('user_supabase_url') &&
                localStorage.getItem('user_supabase_key'));
    },

    // Redirect to setup wizard if not configured. Call at page init.
    requireConfig: function () {
      if (!this.isConfigured()) {
        window.location.href = 'setup.html';
        return false;
      }
      return true;
    }
  };
})();
