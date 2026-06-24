-- ============================================================
-- Charlie Dashboard — Supabase Schema
-- Paste this into your Supabase SQL editor and click Run.
--
-- Row Level Security is enabled with a permissive policy (FOR ALL
-- USING (true)). This is appropriate for a personal single-user
-- dashboard — tighten policies if you ever share the project.
-- ============================================================

-- Garmin daily wellness metrics (synced automatically if Garmin is connected,
-- or entered manually via the HEALTH tab)
CREATE TABLE IF NOT EXISTS garmin_daily (
  date          date    PRIMARY KEY,
  body_battery  int,
  resting_hr    int,
  stress        int,
  sleep_hours   numeric
);

-- Garmin activity log (synced from Garmin Connect automatically)
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

-- Daily wellness check-in (logged via the WELLNESS tab)
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

-- Recovery sessions (logged via the RECOVERY tab)
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

-- Cloud sync state store (used by sync.js to persist app state across devices)
CREATE TABLE IF NOT EXISTS app_state (
  key        text PRIMARY KEY,
  data       jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE garmin_daily      ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state         ENABLE ROW LEVEL SECURITY;

-- Permissive policies: anon key has full read/write access.
-- Suitable for a personal dashboard. Restrict to auth.uid() checks
-- if you ever add user accounts.
CREATE POLICY IF NOT EXISTS "allow_all_garmin_daily"      ON garmin_daily      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_garmin_activities" ON garmin_activities  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_readiness"         ON readiness          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_recovery_sessions" ON recovery_sessions  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_app_state"         ON app_state          FOR ALL USING (true) WITH CHECK (true);
