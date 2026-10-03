import { sendDueDigests } from "@/lib/digest.ts";
import { sendBillingReminders } from "@/lib/reminders.ts";

// Run daily from any scheduler: curl -H "Authorization: Bearer $CRON_SECRET" https://app/api/cron/digests
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  return Response.json({ digests: await sendDueDigests(appUrl), billing: await sendBillingReminders(appUrl) });
}
