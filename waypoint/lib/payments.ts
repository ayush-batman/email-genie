// Payment provider webhooks → normalized payments. Pure functions (no I/O), so they are unit-tested directly.
import { createHmac, timingSafeEqual } from "node:crypto";

export const PROVIDERS = ["stripe", "lemonsqueezy", "polar", "paddle"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type Payment = {
  eventId: string; // provider event id (idempotency)
  kind: "payment" | "renewal" | "refund";
  amount: number; // minor units; refunds carry the CUMULATIVE refunded amount for orderId (see refundDelta)
  currency: string; // ISO, upper case
  orderId: string;
  customerId: string;
  visitorId: string;
  userId: string;
  sessionId: string;
  at: Date;
};

/** Customer→visitor links learned from checkouts that carry no amount (e.g. Stripe subscription checkouts). */
export type CustomerLink = { customerId: string; visitorId: string; userId: string };
export type Parsed = { payments: Payment[]; links: CustomerLink[] };

const TOLERANCE_S = 5 * 60;

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const hmac = (key: string | Buffer, msg: string, enc: "hex" | "base64") => createHmac("sha256", key).update(msg).digest(enc);
const fresh = (ts: number, now: number) => Number.isFinite(ts) && Math.abs(now / 1000 - ts) <= TOLERANCE_S;

/** Verifies the provider's signature over the raw body. `now` is injectable for tests. */
export function verifySignature(provider: Provider, secret: string, body: string, h: Headers, now = Date.now()): boolean {
  switch (provider) {
    case "stripe": {
      // Stripe-Signature: t=...,v1=...[,v1=...]; signed payload "t.body"; only v1 counts.
      const parts = (h.get("stripe-signature") ?? "").split(",").map((p) => p.split("="));
      const t = Number(parts.find(([k]) => k === "t")?.[1]);
      const expected = hmac(secret, `${t}.${body}`, "hex");
      return fresh(t, now) && parts.some(([k, v]) => k === "v1" && !!v && safeEq(v, expected));
    }
    case "lemonsqueezy":
      // X-Signature: hex HMAC-SHA256 of the raw body.
      return safeEq(h.get("x-signature") ?? "", hmac(secret, body, "hex"));
    case "paddle": {
      // Paddle-Signature: ts=...;h1=...; signed payload "ts:body".
      const parts = Object.fromEntries((h.get("paddle-signature") ?? "").split(";").map((p) => p.split("=") as [string, string]));
      const ts = Number(parts.ts);
      return fresh(ts, now) && !!parts.h1 && safeEq(parts.h1, hmac(secret, `${ts}:${body}`, "hex"));
    }
    case "polar": {
      // Standard Webhooks: "id.timestamp.body", base64 HMAC, header "v1,<sig> v1,<sig>".
      // Polar secrets created before 2026-09-08 use the raw "whsec_..." string as key; newer ones the base64-decoded remainder. Try both.
      const id = h.get("webhook-id") ?? "", ts = Number(h.get("webhook-timestamp"));
      const sigs = (h.get("webhook-signature") ?? "").split(" ").map((s) => s.split(",")[1] ?? "");
      const keys = [Buffer.from(secret, "utf8"), Buffer.from(secret.replace(/^whsec_/, ""), "base64")];
      return fresh(ts, now) && keys.some((k) => { const e = hmac(k, `${id}.${ts}.${body}`, "base64"); return sigs.some((s) => safeEq(s, e)); });
    }
  }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const ids = (meta: Json | null | undefined) => ({
  visitorId: str(meta?.waypoint_visitor_id),
  userId: str(meta?.waypoint_user_id),
  sessionId: str(meta?.waypoint_session_id),
});

/** Maps a verified webhook body to payments. Unknown/irrelevant events return nothing. */
export function parseWebhook(provider: Provider, body: string, h: Headers): Parsed {
  const e = JSON.parse(body) as Json;
  const none: Parsed = { payments: [], links: [] };

  if (provider === "stripe") {
    const o = e.data?.object ?? {};
    const at = new Date((e.created ?? 0) * 1000);
    const customerId = str(o.customer);
    if (e.type === "checkout.session.completed") {
      const meta = { ...o.metadata, waypoint_visitor_id: o.metadata?.waypoint_visitor_id ?? o.client_reference_id };
      const link = { customerId, ...ids(meta) };
      // Subscription checkouts are paid via invoice.paid; only remember who the customer is.
      if (o.mode !== "payment" || o.payment_status !== "paid") return { payments: [], links: customerId ? [link] : [] };
      return {
        links: customerId ? [link] : [],
        payments: [{ eventId: e.id, kind: "payment", amount: o.amount_total ?? 0, currency: str(o.currency).toUpperCase(), orderId: str(o.payment_intent || o.id), customerId, ...ids(meta), at }],
      };
    }
    if (e.type === "invoice.paid" && (o.amount_paid ?? 0) > 0) {
      const meta = o.parent?.subscription_details?.metadata ?? o.subscription_details?.metadata ?? o.metadata;
      const renewal = o.billing_reason === "subscription_cycle";
      return { links: [], payments: [{ eventId: e.id, kind: renewal ? "renewal" : "payment", amount: o.amount_paid, currency: str(o.currency).toUpperCase(), orderId: str(o.id), customerId, ...ids(meta), at }] };
    }
    if (e.type === "charge.refunded") {
      return { links: [], payments: [{ eventId: e.id, kind: "refund", amount: o.amount_refunded ?? 0, currency: str(o.currency).toUpperCase(), orderId: str(o.payment_intent || o.id), customerId, ...ids(o.metadata), at }] };
    }
    return none;
  }

  if (provider === "lemonsqueezy") {
    const name = str(e.meta?.event_name ?? h.get("x-event-name"));
    const a = e.data?.attributes ?? {};
    const base = { currency: str(a.currency).toUpperCase(), customerId: str(a.customer_id), ...ids(e.meta?.custom_data), at: new Date(a.updated_at ?? a.created_at ?? Date.now()) };
    // LS sends no event id; the resource id + event name + amount is unique per delivery we care about.
    if (name === "order_created" && a.status === "paid")
      return { links: [], payments: [{ ...base, eventId: `${name}:${e.data.id}`, kind: "payment", amount: a.total ?? 0, orderId: str(e.data.id) }] };
    if (name === "subscription_payment_success" && a.billing_reason === "renewal")
      return { links: [], payments: [{ ...base, eventId: `${name}:${e.data.id}`, kind: "renewal", amount: a.total ?? 0, orderId: str(e.data.id) }] };
    if (name === "order_refunded")
      return { links: [], payments: [{ ...base, eventId: `${name}:${e.data.id}:${a.refunded_amount}`, kind: "refund", amount: a.refunded_amount ?? a.total ?? 0, orderId: str(e.data.id) }] };
    return none;
  }

  if (provider === "polar") {
    const o = e.data ?? {};
    const at = new Date(e.timestamp ?? o.modified_at ?? o.created_at ?? Date.now());
    const base = { currency: str(o.currency).toUpperCase(), orderId: str(o.id), customerId: str(o.customer_id), ...ids(o.metadata), at, userId: str(o.metadata?.waypoint_user_id || o.customer?.external_id) };
    const eventId = h.get("webhook-id") ?? `${e.type}:${o.id}`;
    if (e.type === "order.paid")
      return { links: [], payments: [{ ...base, eventId, kind: o.billing_reason === "subscription_cycle" ? "renewal" : "payment", amount: o.total_amount ?? 0 }] };
    if (e.type === "order.refunded")
      return { links: [], payments: [{ ...base, eventId, kind: "refund", amount: o.refunded_amount ?? 0 }] };
    return none;
  }

  // paddle
  const d = e.data ?? {};
  const at = new Date(e.occurred_at ?? Date.now());
  if (e.event_type === "transaction.completed") {
    const total = Number(d.details?.totals?.total ?? 0);
    if (!total) return none;
    return { links: [], payments: [{ eventId: e.event_id, kind: d.origin === "subscription_recurring" ? "renewal" : "payment", amount: total, currency: str(d.currency_code), orderId: str(d.id), customerId: str(d.customer_id), ...ids(d.custom_data), at }] };
  }
  if ((e.event_type === "adjustment.created" || e.event_type === "adjustment.updated") && d.action === "refund" && d.status === "approved") {
    // Each approved adjustment is its own refund; not cumulative, so key the order by adjustment id.
    return { links: [], payments: [{ eventId: `adjustment:${d.id}`, kind: "refund", amount: Number(d.totals?.total ?? 0), currency: str(d.currency_code), orderId: `adjustment:${d.id}`, customerId: str(d.customer_id), visitorId: "", userId: "", sessionId: "", at }] };
  }
  return none;
}
