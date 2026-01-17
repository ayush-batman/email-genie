import Link from "next/link";
import { Plus, Users, Search, Building, Mail, Phone } from "lucide-react";

export default function ContactsPage() {
    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Contacts</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        Manage your contacts and their meeting history.
                    </p>
                </div>
                <Link
                    href="/contacts/new"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2 btn-shine"
                >
                    <Plus className="w-4 h-4" />
                    Add Contact
                </Link>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                />
            </div>

            {/* Empty State */}
            <div className="p-12 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-center">
                <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-[hsl(var(--muted-foreground))]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No contacts yet</h3>
                <p className="text-[hsl(var(--muted-foreground))] max-w-md mx-auto mb-6">
                    Add your first contact to start tracking meeting history and
                    generating personalized follow-ups.
                </p>
                <Link
                    href="/contacts/new"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                    Add Your First Contact
                </Link>
            </div>
        </div>
    );
}
