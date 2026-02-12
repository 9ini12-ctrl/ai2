-- Schema v1.0

DO $$ BEGIN
  CREATE TYPE plan_type_enum AS ENUM ('ambassador','branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_mode_enum AS ENUM ('auto','manual_ambassador','manual_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE metric_enum AS ENUM ('boxes','donations','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE done_by_enum AS ENUM ('system','ambassador','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coupon_status_enum AS ENUM ('unlocked','copied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS branches (
  id            BIGSERIAL PRIMARY KEY,
  numfre        TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  vars          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ambassadors (
  id            BIGSERIAL PRIMARY KEY,
  numsafer      TEXT UNIQUE NOT NULL,
  name          TEXT NULL,
  phone         TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  branch_id     BIGINT NULL REFERENCES branches(id) ON DELETE SET NULL,
  vars          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id         BIGSERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  title      TEXT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_wallet (
  id            BIGSERIAL PRIMARY KEY,
  ambassador_id BIGINT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  coupon_id     BIGINT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  date_unlocked DATE NOT NULL,
  copied_at     TIMESTAMPTZ NULL,
  status        coupon_status_enum NOT NULL DEFAULT 'unlocked',
  UNIQUE (ambassador_id, coupon_id),
  UNIQUE (ambassador_id, date_unlocked),
  UNIQUE (coupon_id)
);

CREATE TABLE IF NOT EXISTS daily_plans_ambassadors (
  id        BIGSERIAL PRIMARY KEY,
  date      DATE UNIQUE NOT NULL,
  headline  TEXT NOT NULL DEFAULT '',
  targets   JSONB NOT NULL DEFAULT '{"boxes":0,"donations":0}'::jsonb
);

CREATE TABLE IF NOT EXISTS daily_plans_branches (
  id        BIGSERIAL PRIMARY KEY,
  date      DATE UNIQUE NOT NULL,
  headline  TEXT NOT NULL DEFAULT '',
  targets   JSONB NOT NULL DEFAULT '{"boxes":0,"donations":0}'::jsonb
);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id         BIGSERIAL PRIMARY KEY,
  plan_type  plan_type_enum NOT NULL,
  plan_id    BIGINT NOT NULL,
  title      TEXT NOT NULL,
  task_mode  task_mode_enum NOT NULL DEFAULT 'auto',
  metric     metric_enum NOT NULL DEFAULT 'none',
  threshold  NUMERIC NULL,
  rule       JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Foreign key constraints for plan_tasks -> plans (soft, via triggers later)
CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan ON plan_tasks(plan_type, plan_id);

CREATE TABLE IF NOT EXISTS task_completions (
  id            BIGSERIAL PRIMARY KEY,
  task_id       BIGINT NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  ambassador_id BIGINT REFERENCES ambassadors(id) ON DELETE CASCADE,
  branch_id     BIGINT REFERENCES branches(id) ON DELETE CASCADE,
  is_done       BOOLEAN NOT NULL DEFAULT FALSE,
  done_at       TIMESTAMPTZ,
  done_by       TEXT NOT NULL DEFAULT 'system',
  CHECK ((ambassador_id IS NOT NULL AND branch_id IS NULL) OR (ambassador_id IS NULL AND branch_id IS NOT NULL))
);

-- Ensure a single completion record per task per day for each subject type (ambassador or branch)
CREATE UNIQUE INDEX IF NOT EXISTS ux_task_comp_amb ON task_completions(task_id, date, ambassador_id) WHERE ambassador_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_task_comp_branch ON task_completions(task_id, date, branch_id) WHERE branch_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS messages (
  id            BIGSERIAL PRIMARY KEY,
  date          DATE UNIQUE NOT NULL,
  share_title   TEXT NULL,
  image_url     TEXT NOT NULL DEFAULT '',
  text_template TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS donations (
  id              BIGSERIAL PRIMARY KEY,
  donation_date   TIMESTAMPTZ NOT NULL,
  amount          NUMERIC NOT NULL,
  donor_phone     TEXT NULL,
  referral_code   TEXT NOT NULL,
  source_row_hash TEXT UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_referral ON donations(referral_code);

CREATE TABLE IF NOT EXISTS boxes (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL,
  box_number      TEXT NOT NULL,
  donor_phone     TEXT NULL,
  referral_code   TEXT NOT NULL,
  source_row_hash TEXT UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boxes_date ON boxes(created_at);
CREATE INDEX IF NOT EXISTS idx_boxes_referral ON boxes(referral_code);
