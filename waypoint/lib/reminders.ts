// Daily billing emails: trial ending / ended, and monthly usage at 80% and 100%.
import { sql } from "./db.ts";
import { monthEvents } from "./billing.ts";
import { PLANS, type PlanId } from "./plans.ts";
import { compact } from "./format.ts";
import { layout, sendEmail } from "./email.ts";

async function managers(orgId: string) {
  return (await sql<{ email: string }[]>`SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ${orgId} AND m.role IN ('owner', 'admin')`).map((r) => r.email);
}

export async function sendBillingReminders(appUrl: string): Promise<number> {
  let sent = 0;
  const billing = { href: `${appUrl}/settings/billing`, label: "Choose a plan" };

  const trials = await sql<{ id: string; name: string; trial_ends_at: Date; trial_reminder_sent: number }[]>`
    SELECT id, name, trial_ends_at, trial_reminder_sent FROM organizations
    WHERE plan = 'trial' AND ((trial_ends_at < now() + interval '2 days' AND trial_reminder_sent < 5) OR (trial_ends_at < now() AND trial_reminder_sent < 7))`;
  for (const o of trials) {
    const ended = o.trial_ends_at.getTime() < Date.now();
    const subject = ended ? `Your Waypoint trial for ${o.name} has ended` : `Your Waypoint trial ends in 2 days`;
    const body = ended
      ? "<p>Your dashboards are paused, but we're still collecting data for 14 days so nothing is lost. Pick a plan to keep going.</p>"
      : "<p>Your free trial ends in two days. Choose a plan now to keep your dashboards, funnels and revenue attribution running without a gap.</p>";
    for (const to of await managers(o.id)) await sendEmail({ to, subject, html: layout(subject, body, billing), text: `${subject}. ${appUrl}/settings/billing` });
    await sql`UPDATE organizations SET trial_reminder_sent = ${ended ? 7 : 5} WHERE id = ${o.id}`;
    sent++;
  }

  const month = new Date().toISOString().slice(0, 7);
  const orgs = await sql<{ id: string; name: string; plan: PlanId; usage_alert: string }[]>`SELECT id, name, plan, usage_alert FROM organizations`;
  for (const o of orgs) {
    const limit = (PLANS[o.plan] ?? PLANS.trial).events;
    const used = (await monthEvents(o.id)).total;
    const level = used >= limit ? 100 : used >= limit * 0.8 ? 80 : 0;
    const [m, prev] = o.usage_alert.split(":");
    if (!level || (m === month && Number(prev) >= level)) continue;
    const subject = level === 100 ? `${o.name} used its monthly events` : `${o.name} is at 80% of its monthly events`;
    const body = `<p>You've recorded <b>${compact(used)}</b> of <b>${compact(limit)}</b> events this month on the ${(PLANS[o.plan] ?? PLANS.trial).name} plan. ${level === 100 ? "Tracking continues up to 120%, then pauses until next month." : ""} Upgrading raises the limit immediately.</p>`;
    for (const to of await managers(o.id)) await sendEmail({ to, subject, html: layout(subject, body, { href: `${appUrl}/settings/billing`, label: "Review plan" }), text: `${subject}. ${appUrl}/settings/billing` });
    await sql`UPDATE organizations SET usage_alert = ${`${month}:${level}`} WHERE id = ${o.id}`;
    sent++;
  }
  return sent;
}
