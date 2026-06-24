// Shared credential manager. Loaded synchronously on every page before sync.js / topbar.js.
// New users: sign up via login.html.
// Existing owner: credentials are auto-seeded so any fresh browser works without setup.
(function () {
  'use strict';

  // Auto-seed the owner's Supabase credentials on any fresh browser/device.
  // The early-return means this never overwrites credentials set by setup.html or login.html.
  // Anyone who forks and deploys their own copy configures their own project via setup.html.
  (function migrate() {
    if (localStorage.getItem('user_supabase_url')) return;
    localStorage.setItem('user_supabase_url', 'https://mzhplwybcfppobsqwcmm.supabase.co');
    localStorage.setItem('user_supabase_key', 'sb_publishable__ZwmxLQdrUIvTa6Y0zhDbw_2IXYke33');
    localStorage.setItem('setup_completed', '1');
  })();

  // Supabase auth session key for this project (derived from the project ref in the URL).
  var _sessionKey = 'sb-mzhplwybcfppobsqwcmm-auth-token';

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

    // True if a Supabase Auth session is present in localStorage.
    isSignedIn: function () {
      try {
        var raw = localStorage.getItem(_sessionKey);
        if (!raw) return false;
        var s = JSON.parse(raw);
        return !!(s && s.access_token);
      } catch (e) { return false; }
    },

    // Redirect to login.html if not signed in. Synchronous — safe to call at page top.
    requireAuth: function () {
      if (!this.isSignedIn()) {
        var here = encodeURIComponent(
          (window.location.pathname.split('/').pop()) || 'index.html'
        );
        window.location.replace('login.html?next=' + here);
        return false;
      }
      return true;
    },

    // Backward-compat alias — pages that call requireConfig() now get auth check.
    requireConfig: function () {
      return this.requireAuth();
    },

    // Sign out: clears Supabase session then sends user to login.html.
    signOut: async function () {
      try {
        var supa = this.getSupabase();
        if (supa) await supa.auth.signOut();
      } catch (e) {}
      window.location.replace('login.html');
    }
  };
})();
