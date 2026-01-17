import Link from "next/link";
import { Plus, Video, Calendar, ExternalLink } from "lucide-react";

export default function MeetingsPage() {
    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Meetings</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        View your meeting history and transcripts.
                    </p>
                </div>
                <Link
                    href="/meetings/new"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2 btn-shine"
                >
                    <Plus className="w-4 h-4" />
                    Add Meeting
                </Link>
            </div>

            {/* Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4.75 5C3.23 5 2 6.23 2 7.75v8.5C2 17.77 3.23 19 4.75 19h10.03c.73 0 1.4-.3 1.89-.78l4.55-4.55c.49-.49.78-1.16.78-1.89V7.75C22 6.23 20.77 5 19.25 5H4.75zm0 1.5h14.5c.69 0 1.25.56 1.25 1.25v3.97c0 .33-.13.65-.36.88l-4.55 4.55c-.23.23-.55.36-.88.36H4.75c-.69 0-1.25-.56-1.25-1.25v-8.5c0-.69.56-1.25 1.25-1.25z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold mb-1">Zoom</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                            Auto-import meeting transcripts from Zoom
                        </p>
                        <button className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Connect Zoom
                        </button>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500">
                        Pro
                    </span>
                </div>

                <div className="p-6 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold mb-1">Google Meet</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                            Auto-import meeting transcripts from Google Meet
                        </p>
                        <button className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Connect Google
                        </button>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500">
                        Pro
                    </span>
                </div>
            </div>

            {/* Empty State */}
            <div className="p-12 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-center">
                <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-6">
                    <Video className="w-10 h-10 text-[hsl(var(--muted-foreground))]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No meetings yet</h3>
                <p className="text-[hsl(var(--muted-foreground))] max-w-md mx-auto mb-6">
                    Add your first meeting manually or connect Zoom/Google Meet for
                    automatic transcription.
                </p>
                <Link
                    href="/meetings/new"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                    Add Your First Meeting
                </Link>
            </div>
        </div>
    );
}
