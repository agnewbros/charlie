// Shared credential manager. Loaded synchronously on every page before sync.js / topbar.js.
// New users: run setup.html to populate localStorage.
// Existing user: auto-migrated on first load via the migration block below.
(function () {
  'use strict';

  // Auto-seed credentials for the owner of this deployment on any fresh browser/device.
  // The check for user_supabase_url means this never overwrites a setup-wizard entry.
  // Anyone who forks and deploys their own copy will go through setup.html and overwrite
  // these with their own credentials — the seed is only a safety net for the owner.
  (function migrate() {
    if (localStorage.getItem('user_supabase_url')) return; // already configured
    localStorage.setItem('user_supabase_url', 'https://mzhplwybcfppobsqwcmm.supabase.co');
    localStorage.setItem('user_supabase_key', 'sb_publishable__ZwmxLQdrUIvTa6Y0zhDbw_2IXYke33');
    localStorage.setItem('setup_completed', '1');
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
