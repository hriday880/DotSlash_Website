-- Laser Tag Event Database Schema (SQLite / Turso libSQL)
-- Event Date: October 22, 2026 (18:00 to 00:00)

CREATE TABLE IF NOT EXISTS laser_tag_slots (
  slot_id TEXT PRIMARY KEY, -- Format: 2026-10-22|18:00 ... 2026-10-22|23:50
  start_time TEXT NOT NULL,  -- e.g. 18:00
  end_time TEXT NOT NULL,    -- e.g. 18:10 (or 00:00)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laser_tag_registrations (
  registration_id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES laser_tag_slots(slot_id),
  team TEXT NOT NULL CHECK (team IN ('Team A', 'Team B')),
  captain_name TEXT NOT NULL,
  captain_email TEXT NOT NULL,
  captain_phone TEXT NOT NULL,
  player_count INTEGER NOT NULL CHECK (player_count BETWEEN 1 AND 4),
  total_fee INTEGER NOT NULL,
  upi_payload TEXT NOT NULL,
  utr_reference TEXT,
  screenshot_url TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (payment_status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED')),
  booking_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (booking_status IN ('PENDING_APPROVAL', 'CONFIRMED', 'REJECTED')),
  admin_note TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laser_tag_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id TEXT NOT NULL REFERENCES laser_tag_registrations(registration_id) ON DELETE CASCADE,
  player_number INTEGER NOT NULL CHECK (player_number BETWEEN 1 AND 4),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_laser_tag_reg_slot_team ON laser_tag_registrations(slot_id, team, booking_status);
CREATE INDEX IF NOT EXISTS idx_laser_tag_players_reg ON laser_tag_players(registration_id);
