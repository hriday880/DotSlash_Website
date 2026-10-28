-- DotSlash × Glitch Laser Tag · 2 Nov 2026
-- Lives in the shared `dotslash` database, whose token also ships to browsers.
-- So every booking row carries `sig`, an HMAC by the API's SIGNING_SECRET:
-- rows the browser token inserts or edits fail verification and are ignored.
-- Promo codes live in the API's PROMO_CODES env var, not here.
--
-- Booking lifecycle:
--   HOLD     seats held 15 min while the player pays by UPI and submits UTR + screenshot
--   PENDING  UTR + screenshot submitted; seats stay held until an admin checks the bank credit
--   PAID     approved by an admin → ticket issued
--   REJECTED admin couldn't find the payment; seats + promo released
--   EXPIRED  no UTR within 15 min; seats + promo released

CREATE TABLE IF NOT EXISTS lt_bookings (
  id TEXT PRIMARY KEY,                 -- LT-XXXXXXXX, also the UPI payment note
  slot INTEGER NOT NULL,
  team TEXT NOT NULL,
  mode TEXT NOT NULL,
  seats INTEGER NOT NULL,
  squad_name TEXT,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  players_json TEXT NOT NULL,
  base_amount INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  promo_code TEXT,
  status TEXT NOT NULL,
  hold_expires_at INTEGER,             -- epoch ms; only meaningful while HOLD
  utr TEXT,
  utr_submitted_at INTEGER,
  proof_hash TEXT,                     -- sha256 of the screenshot in lt_payment_proofs
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  checked_in_at INTEGER,
  note TEXT,
  sig TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lt_bookings_slot_status ON lt_bookings(slot, status);

-- Payment screenshot submitted with the UTR (client-compressed JPEG data URL).
CREATE TABLE IF NOT EXISTS lt_payment_proofs (
  booking_id TEXT PRIMARY KEY,
  image TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
