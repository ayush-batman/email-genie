"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Video, Calendar, Loader2 } from "lucide-react";

export default function NewMeetingPage() {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [transcript, setTranscript] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // TODO: Save meeting to database
        setTimeout(() => {
            setLoading(false);
            window.location.href = "/meetings";
        }, 1000);
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/meetings"
                    className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Meetings
                </Link>
                <h1 className="text-3xl font-bold mb-2">Add Meeting</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Manually add a meeting with its transcript.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Video className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            Meeting Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Product Demo with Acme Inc."
                            required
                            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            Meeting Date
                        </label>
                        <input
                            type="datetime-local"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Transcript (optional)
                        </label>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            placeholder="Paste your meeting transcript here..."
                            rows={10}
                            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <Link
                        href="/meetings"
                        className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors text-center font-medium"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "Save Meeting"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
