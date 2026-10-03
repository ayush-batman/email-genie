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
;
-- One row per visit, maintained by sessions_mv as events arrive. Rows for the same session from different insert
-- batches are merged in the background, and at query time by GROUP BY session_id. Revenue rows are excluded:
-- they're read from events so payments count on the day they happen.
CREATE TABLE IF NOT EXISTS sessions (
  site_id UUID,
  day Date,
  session_id String,
  start SimpleAggregateFunction(min, DateTime64(3, 'UTC')),
  end SimpleAggregateFunction(max, DateTime64(3, 'UTC')),
  visitor_id SimpleAggregateFunction(any, String),
  hits SimpleAggregateFunction(sum, UInt64),
  pv SimpleAggregateFunction(sum, UInt64),
  ev SimpleAggregateFunction(sum, UInt64),
  engaged SimpleAggregateFunction(sum, UInt64),
  entry_path AggregateFunction(argMin, String, DateTime64(3, 'UTC')),
  exit_path AggregateFunction(argMax, String, DateTime64(3, 'UTC')),
  hostname SimpleAggregateFunction(any, LowCardinality(String)),
  referrer_domain SimpleAggregateFunction(any, LowCardinality(String)),
  channel SimpleAggregateFunction(any, LowCardinality(String)),
  utm_source SimpleAggregateFunction(any, LowCardinality(String)),
  utm_medium SimpleAggregateFunction(any, LowCardinality(String)),
  utm_campaign SimpleAggregateFunction(any, String),
  utm_term SimpleAggregateFunction(any, String),
  utm_content SimpleAggregateFunction(any, String),
  country SimpleAggregateFunction(any, LowCardinality(String)),
  region SimpleAggregateFunction(any, LowCardinality(String)),
  city SimpleAggregateFunction(any, String),
  browser SimpleAggregateFunction(any, LowCardinality(String)),
  os SimpleAggregateFunction(any, LowCardinality(String)),
  device SimpleAggregateFunction(any, LowCardinality(String)),
  screen_bucket SimpleAggregateFunction(any, LowCardinality(String)),
  language SimpleAggregateFunction(any, LowCardinality(String)),
  import_id SimpleAggregateFunction(any, String)
) ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (site_id, day, session_id)
;
CREATE MATERIALIZED VIEW IF NOT EXISTS sessions_mv TO sessions AS
SELECT site_id, toDate(min(ts)) AS day, session_id,
  min(ts) AS start, max(ts) AS end, any(visitor_id) AS visitor_id,
  count() AS hits, countIf(type = 'pageview') AS pv, countIf(type = 'event') AS ev, sum(engaged_ms) AS engaged,
  argMinStateIf(url_path, ts, type = 'pageview') AS entry_path, argMaxStateIf(url_path, ts, type = 'pageview') AS exit_path,
  any(hostname) AS hostname, any(referrer_domain) AS referrer_domain, any(channel) AS channel,
  any(utm_source) AS utm_source, any(utm_medium) AS utm_medium, any(utm_campaign) AS utm_campaign, any(utm_term) AS utm_term, any(utm_content) AS utm_content,
  any(country) AS country, any(region) AS region, any(city) AS city, any(browser) AS browser, any(os) AS os, any(device) AS device,
  any(screen_bucket) AS screen_bucket, any(language) AS language, any(import_id) AS import_id
FROM events WHERE type != 'revenue'
GROUP BY site_id, session_id
