import { Clock, Shield, UserMinus, X } from "lucide-react";
import { requireOrg } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { ago } from "@/lib/format.ts";
import { InviteForm, RenameForm } from "@/components/team-forms.tsx";
import { changeRole, inviteMember, removeMember, renameOrg, revokeInvite } from "../../actions.ts";

export const metadata = { title: "Team" };

const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including billing and deleting the team",
  admin: "Manage sites, members, payments and API keys",
  member: "View everything; create funnels, goals and reports",
  viewer: "Read-only access to dashboards",
};

export default async function TeamPage() {
  const { org, role, user } = await requireOrg();
  const manager = role === "owner" || role === "admin";
  const [members, invites, log] = await Promise.all([
    sql<{ id: string; email: string; name: string; role: string }[]>`
      SELECT u.id, u.email, u.name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ${org.id}
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, u.email`,
    sql<{ id: string; email: string; role: string; expires_at: Date }[]>`
      SELECT id, email, role, expires_at FROM invitations WHERE org_id = ${org.id} AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
    manager ? sql<{ action: string; target: string; created_at: Date; actor: string | null }[]>`
      SELECT a.action, a.target, a.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.org_id = ${org.id} ORDER BY a.created_at DESC LIMIT 25` : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <section className="panel p-6">
        <h2 className="font-semibold">Team name</h2>
        <div className="mt-3">{manager ? <RenameForm action={renameOrg} name={org.name} /> : <p className="text-sm">{org.name}</p>}</div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-6">
          <h2 className="font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted">{members.length} {members.length === 1 ? "person has" : "people have"} access to every website in {org.name}.</p>
          {manager && <div className="mt-4"><InviteForm action={inviteMember} /></div>}
        </div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{(m.name || m.email)[0]!.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name || m.email}{m.id === user.id && <span className="ml-1.5 text-xs text-muted">(you)</span>}</p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              {manager && m.role !== "owner" && m.id !== user.id ? (
                <>
                  <form action={changeRole.bind(null, m.id)} className="flex items-center gap-1">
                    <select name="role" defaultValue={m.role} className="input h-8 w-28 text-xs" aria-label={`Role for ${m.email}`}>
                      <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
                    </select>
                    <button className="btn-ghost h-8 px-2 text-xs">Update</button>
                  </form>
                  <form action={removeMember.bind(null, m.id)}>
                    <button className="rounded-md p-2 text-faint hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${m.email}`}><UserMinus className="h-4 w-4" /></button>
                  </form>
                </>
              ) : (
                <span className="chip bg-subtle capitalize text-muted" title={ROLE_HELP[m.role]}>{m.role === "owner" && <Shield className="h-3 w-3" />}{m.role}</span>
              )}
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 bg-subtle/60 px-6 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-strong text-faint"><Clock className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="text-xs text-muted">Invited as {i.role} · expires {ago(i.expires_at).replace(" ago", "")}</p>
              </div>
              <span className="chip bg-warn-soft text-warn">Pending</span>
              {manager && <form action={revokeInvite.bind(null, i.id)}><button className="rounded-md p-2 text-faint hover:bg-bad-soft hover:text-bad" aria-label={`Revoke invite for ${i.email}`}><X className="h-4 w-4" /></button></form>}
            </li>
          ))}
        </ul>
        <div className="grid gap-x-6 gap-y-1 border-t border-line bg-subtle px-6 py-4 text-xs text-muted sm:grid-cols-2">
          {Object.entries(ROLE_HELP).map(([r, h]) => <p key={r}><b className="capitalize text-fg">{r}</b> · {h}</p>)}
        </div>
      </section>

      {manager && (
        <section className="panel overflow-hidden">
          <h2 className="border-b border-line p-6 font-semibold">Audit log</h2>
          {log.length === 0 ? <p className="p-6 text-sm text-muted">No activity yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {log.map((l, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2.5">
                  <code className="rounded bg-subtle px-1.5 py-0.5 text-xs">{l.action}</code>
                  <span className="min-w-0 flex-1 truncate">{l.target}</span>
                  <span className="text-xs text-muted">{l.actor ?? "—"} · {ago(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
