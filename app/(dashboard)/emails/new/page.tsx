"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Sparkles,
    Loader2,
    Copy,
    Check,
    Mail,
    RefreshCw,
    Save,
    Send,
} from "lucide-react";

interface GeneratedEmail {
    subject: string;
    body: string;
    keyPoints: string[];
}

interface EmailScore {
    overall: number;
    clarity: number;
    personalization: number;
    callToAction: number;
    tone: number;
}

export default function NewEmailPage() {
    const [transcript, setTranscript] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactCompany, setContactCompany] = useState("");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [tone, setTone] = useState<"professional" | "friendly" | "casual">("professional");
    const [loading, setLoading] = useState(false);
    const [scoring, setScoring] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
    const [emailScore, setEmailScore] = useState<EmailScore | null>(null);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (generatedEmail?.subject && generatedEmail?.body) {
            const timeout = setTimeout(() => scoreEmail(generatedEmail.subject, generatedEmail.body), 1000);
            return () => clearTimeout(timeout);
        }
    }, [generatedEmail?.subject, generatedEmail?.body]);

    const scoreEmail = async (subject: string, body: string) => {
        setScoring(true);
        try {
            const res = await fetch("/api/ai/score-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, body }),
            });
            if (res.ok) {
                const { score } = await res.json();
                setEmailScore(score);
            }
        } catch { } finally {
            setScoring(false);
        }
    };

    const handleGenerate = async () => {
        if (!transcript.trim()) {
            setError("Please enter a transcript");
            return;
        }
        setLoading(true);
        setError(null);
        setEmailScore(null);

        try {
            const res = await fetch("/api/ai/generate-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript, contactName, contactCompany, meetingTitle, tone }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setGeneratedEmail(data);
            setSaved(false);
        } catch {
            setError("Failed to generate. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!generatedEmail) return;
        setSaving(true);
        try {
            const res = await fetch("/api/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: generatedEmail.subject,
                    body: generatedEmail.body,
                    keyPoints: generatedEmail.keyPoints,
                    status: 'draft',
                }),
            });
            if (res.ok) setSaved(true);
        } catch { } finally {
            setSaving(false);
        }
    };

    const handleCopy = () => {
        if (!generatedEmail) return;
        navigator.clipboard.writeText(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSend = async () => {
        if (!generatedEmail || !recipientEmail) {
            setError("Please enter recipient email");
            return;
        }
        setSending(true);
        setError(null);
        try {
            const res = await fetch("/api/emails/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject: generatedEmail.subject,
                    body: generatedEmail.body,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to send");
            }
            setSent(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to send email");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/emails" className="p-1.5 rounded hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">
                    <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </Link>
                <h1 className="text-lg font-semibold">New Email</h1>
            </div>

            <div className="grid grid-cols-2 gap-8">
                {/* Left: Input */}
                <div className="space-y-4">
                    <div className="card p-4 space-y-4">
                        <div>
                            <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">Meeting Title</label>
                            <input
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="e.g., Q4 Review"
                                className="input"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">Contact</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder="Name"
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">Company</label>
                                <input
                                    type="text"
                                    value={contactCompany}
                                    onChange={(e) => setContactCompany(e.target.value)}
                                    placeholder="Company"
                                    className="input"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">Tone</label>
                            <div className="flex gap-2">
                                {(["professional", "friendly", "casual"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTone(t)}
                                        className={`flex-1 py-2 text-sm rounded-md border transition-colors ${tone === t
                                            ? "bg-[hsl(var(--primary))] text-white border-transparent"
                                            : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]"
                                            }`}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card p-4">
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">Transcript</label>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            placeholder="Paste your meeting transcript..."
                            rows={10}
                            className="input resize-none"
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{transcript.length} characters</p>
                    </div>

                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !transcript.trim()}
                        className="w-full bg-[hsl(var(--primary))] text-white py-2.5 rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Generating...</>
                        ) : (
                            <><Sparkles className="w-4 h-4" strokeWidth={1.5} /> Generate Email</>
                        )}
                    </button>
                </div>

                {/* Right: Output */}
                <div>
                    {generatedEmail ? (
                        <div className="space-y-4">
                            {/* Score */}
                            {emailScore && (
                                <div className="card p-4 flex items-center gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-semibold">{emailScore.overall}</div>
                                        <div className="text-xs text-[hsl(var(--muted-foreground))]">Score</div>
                                    </div>
                                    <div className="flex-1 text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                                        <div className="flex justify-between"><span>Clarity</span><span>{emailScore.clarity}</span></div>
                                        <div className="flex justify-between"><span>Tone</span><span>{emailScore.tone}</span></div>
                                        <div className="flex justify-between"><span>Personalization</span><span>{emailScore.personalization}</span></div>
                                    </div>
                                    {scoring && <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
                                </div>
                            )}

                            {/* Recipient */}
                            <div className="card p-4">
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5 block">To</label>
                                <input
                                    type="email"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    placeholder="recipient@example.com"
                                    className="input"
                                />
                            </div>

                            {/* Email */}
                            <div className="card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Generated Email</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setGeneratedEmail(null); setEmailScore(null); handleGenerate(); }} className="p-1.5 rounded hover:bg-[hsl(var(--accent))]">
                                            <RefreshCw className="w-4 h-4 text-[hsl(var(--muted-foreground))]" strokeWidth={1.5} />
                                        </button>
                                        <button onClick={handleCopy} className="p-1.5 rounded hover:bg-[hsl(var(--accent))]">
                                            {copied ? <Check className="w-4 h-4 text-green-500" strokeWidth={1.5} /> : <Copy className="w-4 h-4 text-[hsl(var(--muted-foreground))]" strokeWidth={1.5} />}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={generatedEmail.subject}
                                    onChange={(e) => { setGeneratedEmail({ ...generatedEmail, subject: e.target.value }); setSaved(false); }}
                                    className="w-full bg-transparent text-base font-medium border-none p-0 focus:ring-0 focus:outline-none"
                                    placeholder="Subject"
                                />
                                <textarea
                                    value={generatedEmail.body}
                                    onChange={(e) => { setGeneratedEmail({ ...generatedEmail, body: e.target.value }); setSaved(false); }}
                                    rows={12}
                                    className="w-full bg-transparent text-sm border-none p-0 focus:ring-0 focus:outline-none resize-none text-[hsl(var(--muted-foreground))]"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || saved}
                                    className="py-2.5 px-4 rounded-md border border-[hsl(var(--border))] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[hsl(var(--accent))] disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : saved ? <Check className="w-4 h-4 text-green-500" strokeWidth={1.5} /> : <Save className="w-4 h-4" strokeWidth={1.5} />}
                                    {saved ? 'Saved' : 'Save'}
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="py-2.5 px-4 rounded-md border border-[hsl(var(--border))] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[hsl(var(--accent))] transition-colors"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-500" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={sending || sent || !recipientEmail}
                                    className="flex-1 py-2.5 rounded-md bg-[hsl(var(--primary))] text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : sent ? <Check className="w-4 h-4" strokeWidth={1.5} /> : <Send className="w-4 h-4" strokeWidth={1.5} />}
                                    {sent ? 'Sent!' : 'Send Email'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="card p-12 text-center">
                            <Mail className="w-10 h-10 text-[hsl(var(--muted-foreground))] mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Your generated email will appear here
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
