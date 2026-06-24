-- ============================================================
-- Charlie Dashboard — Supabase Schema
-- Paste this into your Supabase SQL editor and click Run.
--
-- This schema supports multiple users. Each user signs in with
-- email + password via the login.html page. Data is isolated
-- per user through Row Level Security.
--
-- IMPORTANT: Before running this, go to your Supabase project:
--   Authentication → Providers → Email → Enable
-- ============================================================

-- ── App state store ──────────────────────────────────────────
-- Stores localStorage state (gym, health, goals, finance) per user.
-- Primary key is (user_id, key) so each user can have their own
-- 'po-coach', 'health', 'goals', etc. records.
CREATE TABLE IF NOT EXISTS app_state (
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text    NOT NULL,
  data       jsonb,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ── Garmin daily wellness metrics ────────────────────────────
-- Synced automatically if Garmin is connected, or entered manually.
CREATE TABLE IF NOT EXISTS garmin_daily (
  date          date    PRIMARY KEY,
  body_battery  int,
  resting_hr    int,
  stress        int,
  sleep_hours   numeric
);

-- ── Garmin activity log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS garmin_activities (
  activity_id   bigint  PRIMARY KEY,
  activity_type text,
  name          text,
  start_date    date,
  distance_m    numeric,
  duration_s    int,
  avg_hr        int,
  max_hr        int,
  calories      int,
  avg_speed     numeric
);

-- ── Daily wellness check-in ──────────────────────────────────
CREATE TABLE IF NOT EXISTS readiness (
  date             date PRIMARY KEY,
  energy           int,
  motivation       int,
  mood             int,
  sleep_quality    int,
  muscle_soreness  int,
  stress           int,
  joint_pain       int
);

-- ── Recovery sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recovery_sessions (
  id              bigserial PRIMARY KEY,
  date            date,
  method          text,
  duration_minutes int,
  timing          text,
  temperature     int,
  rounds          int,
  body_area       text,
  muscle_group    text,
  intensity       int,
  notes           text
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE app_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_daily      ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_sessions ENABLE ROW LEVEL SECURITY;

-- app_state: each user sees only their own rows
DROP POLICY IF EXISTS "app_state_own" ON app_state;
CREATE POLICY "app_state_own" ON app_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Garmin and wellness tables: accessible to any authenticated user.
-- Garmin data is synced server-side and is shared (owner's data only).
DROP POLICY IF EXISTS "allow_auth_garmin_daily"      ON garmin_daily;
DROP POLICY IF EXISTS "allow_auth_garmin_activities" ON garmin_activities;
DROP POLICY IF EXISTS "allow_auth_readiness"         ON readiness;
DROP POLICY IF EXISTS "allow_auth_recovery_sessions" ON recovery_sessions;

CREATE POLICY "allow_auth_garmin_daily"      ON garmin_daily      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_garmin_activities" ON garmin_activities  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_readiness"         ON readiness          FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_recovery_sessions" ON recovery_sessions  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- MIGRATION — run this if you already have the old schema
-- (where app_state had a single `key` primary key).
-- This drops the old table and recreates it. Your existing
-- app_state data will be re-uploaded automatically the next
-- time you sign in — it lives in your browser's localStorage.
-- ============================================================
-- DROP TABLE IF EXISTS app_state;
-- Then re-run the CREATE TABLE above.
--
-- Or if you prefer an in-place migration:
-- ALTER TABLE app_state DROP CONSTRAINT app_state_pkey;
-- ALTER TABLE app_state ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
-- DELETE FROM app_state WHERE user_id IS NULL;  -- clears old unauthenticated rows
-- ALTER TABLE app_state ADD PRIMARY KEY (user_id, key);
