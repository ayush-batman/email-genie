import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseWebhook, verifySignature } from "./payments.ts";

const now = 1_760_000_000_000;
const ts = Math.floor(now / 1000);
const hex = (k: string | Buffer, m: string) => createHmac("sha256", k).update(m).digest("hex");
const b64 = (k: string | Buffer, m: string) => createHmac("sha256", k).update(m).digest("base64");

test("stripe: valid v1 signature passes; tampered, stale or v0-only fails", () => {
  const body = '{"id":"evt_1"}', secret = "whsec_test";
  const h = (sig: string) => new Headers({ "stripe-signature": sig });
  assert.ok(verifySignature("stripe", secret, body, h(`t=${ts},v1=${hex(secret, `${ts}.${body}`)}`), now));
  assert.ok(!verifySignature("stripe", secret, body + " ", h(`t=${ts},v1=${hex(secret, `${ts}.${body}`)}`), now));
  assert.ok(!verifySignature("stripe", secret, body, h(`t=${ts - 3600},v1=${hex(secret, `${ts - 3600}.${body}`)}`), now));
  assert.ok(!verifySignature("stripe", secret, body, h(`t=${ts},v0=${hex(secret, `${ts}.${body}`)}`), now));
});

test("lemonsqueezy, paddle and polar signatures", () => {
  const body = '{"x":1}';
  assert.ok(verifySignature("lemonsqueezy", "s3cret", body, new Headers({ "x-signature": hex("s3cret", body) }), now));
  assert.ok(!verifySignature("lemonsqueezy", "s3cret", body, new Headers({ "x-signature": hex("other", body) }), now));
  assert.ok(verifySignature("paddle", "pdl", body, new Headers({ "paddle-signature": `ts=${ts};h1=${hex("pdl", `${ts}:${body}`)}` }), now));
  assert.ok(!verifySignature("paddle", "pdl", body, new Headers({ "paddle-signature": `ts=${ts};h1=deadbeef` }), now));
  // Polar: legacy secrets sign with the raw string; Standard Webhooks secrets with the base64-decoded remainder.
  const raw = Buffer.from("key-bytes-0123456789");
  const std = `whsec_${raw.toString("base64")}`;
  const signed = `msg_1.${ts}.${body}`;
  const polar = (key: string | Buffer) => new Headers({ "webhook-id": "msg_1", "webhook-timestamp": String(ts), "webhook-signature": `v1,${b64(key, signed)}` });
  assert.ok(verifySignature("polar", std, body, polar(raw), now));
  assert.ok(verifySignature("polar", "whsec_legacy", body, polar("whsec_legacy"), now));
  assert.ok(!verifySignature("polar", std, body, polar("nope"), now));
});

test("stripe parsing: one-off checkout pays, subscription checkout only links customer, renewals and refunds", () => {
  const h = new Headers();
  const pay = parseWebhook("stripe", JSON.stringify({ id: "evt_a", type: "checkout.session.completed", created: ts, data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", amount_total: 4900, currency: "usd", customer: "cus_1", payment_intent: "pi_1", client_reference_id: "vid-1" } } }), h);
  assert.equal(pay.payments[0]?.amount, 4900);
  assert.equal(pay.payments[0]?.visitorId, "vid-1");
  assert.equal(pay.payments[0]?.currency, "USD");
  const sub = parseWebhook("stripe", JSON.stringify({ id: "evt_b", type: "checkout.session.completed", created: ts, data: { object: { mode: "subscription", payment_status: "paid", customer: "cus_2", metadata: { waypoint_visitor_id: "vid-2" } } } }), h);
  assert.equal(sub.payments.length, 0);
  assert.deepEqual(sub.links, [{ customerId: "cus_2", visitorId: "vid-2", userId: "", sessionId: "" }]);
  const renew = parseWebhook("stripe", JSON.stringify({ id: "evt_c", type: "invoice.paid", created: ts, data: { object: { id: "in_1", amount_paid: 2900, currency: "usd", customer: "cus_2", billing_reason: "subscription_cycle" } } }), h);
  assert.equal(renew.payments[0]?.kind, "renewal");
  const refund = parseWebhook("stripe", JSON.stringify({ id: "evt_d", type: "charge.refunded", created: ts, data: { object: { id: "ch_1", payment_intent: "pi_1", amount_refunded: 1000, currency: "usd" } } }), h);
  assert.deepEqual([refund.payments[0]?.kind, refund.payments[0]?.amount, refund.payments[0]?.orderId], ["refund", 1000, "pi_1"]);
  assert.equal(parseWebhook("stripe", JSON.stringify({ id: "x", type: "customer.created", data: { object: {} } }), h).payments.length, 0);
});

test("lemonsqueezy, polar and paddle parsing", () => {
  const ls = parseWebhook("lemonsqueezy", JSON.stringify({ meta: { event_name: "order_created", custom_data: { waypoint_visitor_id: "v" } }, data: { id: "9", attributes: { status: "paid", total: 1199, currency: "USD" } } }), new Headers());
  assert.deepEqual([ls.payments[0]?.amount, ls.payments[0]?.visitorId], [1199, "v"]);
  const lsInitial = parseWebhook("lemonsqueezy", JSON.stringify({ meta: { event_name: "subscription_payment_success" }, data: { id: "1", attributes: { billing_reason: "initial", total: 1199 } } }), new Headers());
  assert.equal(lsInitial.payments.length, 0, "initial payment is already counted by order_created");
  const polar = parseWebhook("polar", JSON.stringify({ type: "order.paid", data: { id: "o1", total_amount: 9720, currency: "usd", billing_reason: "subscription_cycle", metadata: { waypoint_visitor_id: "v" } } }), new Headers({ "webhook-id": "msg_9" }));
  assert.deepEqual([polar.payments[0]?.kind, polar.payments[0]?.amount, polar.payments[0]?.eventId], ["renewal", 9720, "msg_9"]);
  const paddle = parseWebhook("paddle", JSON.stringify({ event_id: "evt_p", event_type: "transaction.completed", data: { id: "txn_1", origin: "web", currency_code: "EUR", details: { totals: { total: "1500" } }, custom_data: { waypoint_visitor_id: "v" } } }), new Headers());
  assert.deepEqual([paddle.payments[0]?.amount, paddle.payments[0]?.currency, paddle.payments[0]?.kind], [1500, "EUR", "payment"]);
  const adj = parseWebhook("paddle", JSON.stringify({ event_id: "e", event_type: "adjustment.updated", data: { id: "adj_1", action: "refund", status: "pending_approval", totals: { total: "500" } } }), new Headers());
  assert.equal(adj.payments.length, 0, "only approved refunds count");
});
