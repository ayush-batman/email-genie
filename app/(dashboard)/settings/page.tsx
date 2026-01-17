import { createClient } from "@/lib/supabase/server";
import { User, Mail, CreditCard, Bell, Shield } from "lucide-react";

export default async function SettingsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Manage your account settings and preferences.
                </p>
            </div>

            <div className="space-y-6">
                {/* Profile Section */}
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-[hsl(var(--primary))]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Profile</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Your personal information
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <input
                                    type="text"
                                    defaultValue={user?.user_metadata?.full_name || ""}
                                    className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ""}
                                    disabled
                                    className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <button className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity">
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Subscription Section */}
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Subscription</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Manage your plan and billing
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Free Plan</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    5 meetings • 10 emails • 20 contacts
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium">
                                Current
                            </span>
                        </div>
                    </div>

                    <button className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity">
                        Upgrade to Pro - $29/month
                    </button>
                </div>

                {/* Notifications Section */}
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Notifications</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Configure email notifications
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[
                            { label: "Email when meeting is transcribed", enabled: true },
                            { label: "Weekly summary email", enabled: true },
                            { label: "Marketing emails", enabled: false },
                        ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <span className="text-sm">{item.label}</span>
                                <button
                                    className={`w-12 h-6 rounded-full transition-colors ${item.enabled
                                            ? "bg-[hsl(var(--primary))]"
                                            : "bg-[hsl(var(--muted))]"
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${item.enabled ? "translate-x-6" : "translate-x-0.5"
                                            }`}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Irreversible actions
                            </p>
                        </div>
                    </div>

                    <button className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
}
