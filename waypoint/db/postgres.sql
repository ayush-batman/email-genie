-- App data. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY, -- sha256(token)
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trial_ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  name text NOT NULL,
  domain text NOT NULL,
  mode text NOT NULL DEFAULT 'private' CHECK (mode IN ('private', 'product')),
  timezone text NOT NULL DEFAULT 'UTC',
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_org_idx ON sites(org_id);

-- Private mode: random salt per UTC day; old salts are deleted so visitors can't be linked across days.
CREATE TABLE IF NOT EXISTS daily_salts (
  day date PRIMARY KEY,
  salt text NOT NULL
);

ALTER TABLE sites ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- A goal is a pageview path (exact, or prefix with trailing *) or a custom event name.
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pageview', 'event')),
  match text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_site_idx ON goals(site_id);

-- Payment provider webhooks. Secrets are AES-256-GCM encrypted (lib/crypto.ts).
CREATE TABLE IF NOT EXISTS revenue_connections (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'lemonsqueezy', 'polar', 'paddle', 'api')),
  secret_enc text NOT NULL,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, provider)
);

-- Idempotency: each provider event is recorded once.
CREATE TABLE IF NOT EXISTS revenue_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

-- Remembers which visitor a provider customer is, so renewals and refunds without metadata are still attributed.
CREATE TABLE IF NOT EXISTS revenue_customers (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider text NOT NULL,
  customer_id text NOT NULL,
  visitor_id text NOT NULL DEFAULT '',
  user_id text NOT NULL DEFAULT '',
  PRIMARY KEY (site_id, provider, customer_id)
);

-- Funnels: ordered steps, each a page path (exact or prefix*) or event name.
CREATE TABLE IF NOT EXISTS funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  steps jsonb NOT NULL,
  window_hours int NOT NULL DEFAULT 24 CHECK (window_hours BETWEEN 1 AND 2160),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnels_site_idx ON funnels(site_id);

-- Weekly/monthly email digests per user and site.
CREATE TABLE IF NOT EXISTS email_reports (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  last_sent_at timestamptz,
  PRIMARY KEY (site_id, user_id)
);
