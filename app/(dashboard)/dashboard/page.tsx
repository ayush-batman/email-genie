import Link from "next/link";
import {
    Video,
    Mail,
    Users,
    FileText,
    ArrowRight,
    Clock,
    Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

    // Fetch counts
    const [
        { count: meetingsCount },
        { count: emailsCount },
        { count: contactsCount },
        { count: templatesCount },
        { data: recentEmails },
    ] = await Promise.all([
        supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('user_id', user?.id),
        supabase.from('generated_emails').select('*', { count: 'exact', head: true }).eq('user_id', user?.id),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user?.id),
        supabase.from('email_templates').select('*', { count: 'exact', head: true }).eq('user_id', user?.id),
        supabase.from('generated_emails').select('id, subject, status, created_at').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const stats = [
        { label: "Meetings", value: meetingsCount || 0, icon: Video, href: "/meetings" },
        { label: "Emails", value: emailsCount || 0, icon: Mail, href: "/emails" },
        { label: "Contacts", value: contactsCount || 0, icon: Users, href: "/contacts" },
        { label: "Templates", value: templatesCount || 0, icon: FileText, href: "/templates" },
    ];

    return (
        <div className="max-w-4xl animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold mb-1">Welcome back, {firstName}</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Here&apos;s an overview of your activity.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="card p-4 hover:border-[hsl(var(--muted-foreground))] transition-colors group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <stat.icon className="w-[18px] h-[18px] text-[hsl(var(--muted-foreground))]" strokeWidth={1.5} />
                            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                        </div>
                        <div className="text-2xl font-semibold mb-0.5">{stat.value}</div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{stat.label}</div>
                    </Link>
                ))}
            </div>

            {/* Quick Action */}
            <div className="mb-8">
                <Link
                    href="/emails/new"
                    className="inline-flex items-center gap-2 bg-[hsl(var(--primary))] text-white px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
                >
                    <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                    Generate Email
                </Link>
            </div>

            {/* Recent Activity */}
            <div>
                <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">Recent Activity</h2>

                {recentEmails && recentEmails.length > 0 ? (
                    <div className="card divide-y divide-[hsl(var(--border))]">
                        {recentEmails.map((email) => (
                            <div key={email.id} className="flex items-center gap-3 px-4 py-3">
                                <Mail className="w-4 h-4 text-[hsl(var(--muted-foreground))]" strokeWidth={1.5} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{email.subject || 'Untitled email'}</p>
                                </div>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {formatRelativeTime(email.created_at)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card p-8 text-center">
                        <Clock className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-3" strokeWidth={1.5} />
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            No activity yet. Generate your first email to get started.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
