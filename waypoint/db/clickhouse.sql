CREATE TABLE IF NOT EXISTS events (
  site_id UUID,
  ts DateTime64(3, 'UTC'),
  type LowCardinality(String),
  name LowCardinality(String),
  visitor_id String,
  session_id String,
  user_id String,
  hostname LowCardinality(String),
  url_path String,
  title String,
  referrer_domain LowCardinality(String),
  channel LowCardinality(String),
  utm_source LowCardinality(String),
  utm_medium LowCardinality(String),
  utm_campaign String,
  utm_term String,
  utm_content String,
  country LowCardinality(String),
  region LowCardinality(String),
  city String,
  browser LowCardinality(String),
  os LowCardinality(String),
  device LowCardinality(String),
  screen_bucket LowCardinality(String),
  language LowCardinality(String),
  engaged_ms UInt32,
  props Map(String, String),
  revenue_minor Int64,
  revenue_currency LowCardinality(String)
) ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (site_id, toDate(ts), visitor_id, ts)
;
ALTER TABLE events ADD COLUMN IF NOT EXISTS import_id String DEFAULT ''
