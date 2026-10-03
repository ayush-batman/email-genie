import Link from "next/link";
import { MailX, Users } from "lucide-react";
import { currentUser, tokenHash } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { Logo } from "@/components/logo.tsx";
import { acceptInvite } from "../../actions.ts";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = await sql<{ org: string; role: string; email: string; inviter: string | null }[]>`
    SELECT o.name AS org, i.role, i.email, COALESCE(NULLIF(u.name, ''), u.email) AS inviter
    FROM invitations i JOIN organizations o ON o.id = i.org_id LEFT JOIN users u ON u.id = i.invited_by
    WHERE i.token_hash = ${tokenHash(token)} AND i.accepted_at IS NULL AND i.expires_at > now()`;
  const user = await currentUser();
  const next = `/invite/${token}`;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block"><Logo /></Link>
        <div className="panel p-8 text-center">
          {!inv ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bad-soft text-bad"><MailX className="h-6 w-6" /></span>
              <h1 className="mt-4 text-xl font-semibold">This invitation isn&apos;t valid</h1>
              <p className="mt-2 text-sm text-muted">It may have expired, been revoked, or already been used. Ask your teammate to send a new one.</p>
              <Link href="/" className="btn-ghost mt-6">Go home</Link>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Users className="h-6 w-6" /></span>
              <h1 className="mt-4 text-xl font-semibold">Join {inv.org}</h1>
              <p className="mt-2 text-sm text-muted">{inv.inviter ?? "A teammate"} invited <b className="text-fg">{inv.email}</b> to Waypoint as <b className="text-fg">{inv.role}</b>.</p>
              {user ? (
                <form action={acceptInvite.bind(null, token)} className="mt-6">
                  <button className="btn h-10 w-full">Accept and continue</button>
                  <p className="mt-3 text-xs text-muted">Signed in as {user.email}</p>
                </form>
              ) : (
                <div className="mt-6 grid gap-2">
                  <Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`} className="btn h-10">Create an account</Link>
                  <Link href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`} className="btn-ghost h-10">I already have an account</Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
