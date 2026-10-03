// Transactional email via Resend's HTTP API. Without RESEND_API_KEY, emails are logged (dev) instead of sent.
export type Email = { to: string; subject: string; html: string; text: string };

export async function sendEmail(e: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${e.to} subject="${e.subject}"\n${e.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Waypoint <hello@example.com>", to: e.to, subject: e.subject, html: e.html, text: e.text }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Minimal, client-safe HTML layout: one column, inline styles. */
export function layout(title: string, body: string, cta?: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8e7e3;border-radius:14px">
<tr><td style="padding:28px 32px 8px;font-weight:600;font-size:15px;color:#5b4cdb">Waypoint</td></tr>
<tr><td style="padding:8px 32px 0;font-size:20px;font-weight:600">${esc(title)}</td></tr>
<tr><td style="padding:12px 32px 28px;font-size:14px;line-height:1.6;color:#3f3f46">${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="background:#5b4cdb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:500;display:inline-block">${esc(cta.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

export { esc };
