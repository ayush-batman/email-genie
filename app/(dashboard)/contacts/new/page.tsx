"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, Mail, Phone, Building, FileText, Loader2 } from "lucide-react";

export default function NewContactPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [company, setCompany] = useState("");
    const [role, setRole] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // TODO: Save contact to database
        setTimeout(() => {
            setLoading(false);
            window.location.href = "/contacts";
        }, 1000);
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/contacts"
                    className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Contacts
                </Link>
                <h1 className="text-3xl font-bold mb-2">Add Contact</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Add a new contact to your CRM.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            Full Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Smith"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@example.com"
                                className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Phone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                Phone
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 (555) 123-4567"
                                className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Building className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                Company
                            </label>
                            <input
                                type="text"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                placeholder="Acme Inc."
                                className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <input
                                type="text"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                placeholder="VP of Sales"
                                className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional notes about this contact..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <Link
                        href="/contacts"
                        className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors text-center font-medium"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "Save Contact"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
