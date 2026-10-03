import { test } from "node:test";
import assert from "node:assert/strict";
import { accessState, canIngest, planForPrice } from "./plans.ts";

const day = 86_400_000, now = Date.UTC(2026, 9, 1);
const org = (o: Partial<{ plan: string; trial_ends_at: Date; subscription_status: string | null }>) => ({ plan: "trial", trial_ends_at: new Date(now + day), subscription_status: null, ...o });

test("access: trial, expired trial, active, past due, canceled", () => {
  assert.equal(accessState(org({}), now), "trial");
  assert.equal(accessState(org({ trial_ends_at: new Date(now - 1) }), now), "trial_expired");
  assert.equal(accessState(org({ plan: "growth", subscription_status: "active" }), now), "active");
  assert.equal(accessState(org({ plan: "growth", subscription_status: "past_due" }), now), "past_due");
  assert.equal(accessState(org({ plan: "growth", subscription_status: "canceled" }), now), "canceled");
});

test("ingest: 14-day grace after trial, 120% hard cap, stops when canceled", () => {
  assert.ok(canIngest(org({ trial_ends_at: new Date(now - 13 * day) }), 0, now));
  assert.ok(!canIngest(org({ trial_ends_at: new Date(now - 15 * day) }), 0, now));
  assert.ok(canIngest(org({ plan: "starter", subscription_status: "active" }), 119_999, now));
  assert.ok(!canIngest(org({ plan: "starter", subscription_status: "active" }), 120_000, now));
  assert.ok(!canIngest(org({ plan: "growth", subscription_status: "canceled" }), 0, now));
});

test("price ids map back to plans", () => {
  process.env.STRIPE_PRICE_GROWTH = "price_g";
  assert.equal(planForPrice("price_g"), "growth");
  assert.equal(planForPrice("price_unknown"), null);
});
