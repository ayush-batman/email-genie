"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Video,
    Users,
    Mail,
    FileText,
    Settings,
    LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface SidebarProps {
    user: User;
}

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Meetings", href: "/meetings", icon: Video },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "Emails", href: "/emails", icon: Mail },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    };

    const initials =
        user.user_metadata?.full_name
            ?.split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase() || user.email?.[0].toUpperCase() || "U";

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] flex flex-col">
            {/* Logo */}
            <div className="h-14 px-4 flex items-center border-b border-[hsl(var(--border))]">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[hsl(var(--primary))] flex items-center justify-center">
                        <Mail className="w-4 h-4 text-white" strokeWidth={1.5} />
                    </div>
                    <span className="font-semibold text-[15px]">EmailGenie</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${isActive
                                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
                                }`}
                        >
                            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-xs font-medium">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {user.user_metadata?.full_name || "User"}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                            {user.email}
                        </p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-1.5 rounded hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                        title="Sign Out"
                    >
                        <LogOut className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
