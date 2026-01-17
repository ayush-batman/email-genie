'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Mail, Plus, Trash2, Loader2, Send, FileText, Calendar,
    CheckCircle, Clock, Edit
} from 'lucide-react';

interface Email {
    id: string;
    subject: string;
    body: string;
    status: 'draft' | 'sent' | 'scheduled';
    sent_at: string | null;
    created_at: string;
    meetings?: { title: string } | null;
    contacts?: { name: string; company: string | null } | null;
}

const statusConfig = {
    draft: { label: 'Draft', icon: Edit, color: 'text-slate-400 bg-slate-400/10' },
    sent: { label: 'Sent', icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
    scheduled: { label: 'Scheduled', icon: Clock, color: 'text-yellow-400 bg-yellow-400/10' },
};

export default function EmailsHistoryPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchEmails();
    }, []);

    const fetchEmails = async () => {
        try {
            const response = await fetch('/api/emails');
            if (response.ok) {
                const data = await response.json();
                setEmails(data.emails || []);
            }
        } catch (error) {
            console.error('Failed to fetch emails:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this email?')) return;

        setDeleting(id);
        try {
            const response = await fetch('/api/emails', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (response.ok) {
                setEmails(emails.filter(e => e.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete email:', error);
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Email History</h1>
                    <p className="text-slate-400">
                        View and manage your generated follow-up emails
                    </p>
                </div>
                <Link
                    href="/emails/new"
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 
                   text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                    Generate Email
                </Link>
            </div>

            {emails.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No emails yet</h3>
                    <p className="text-slate-400 mb-6">
                        Generate your first follow-up email using AI
                    </p>
                    <Link
                        href="/emails/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        <Plus className="w-4 h-4" />
                        Generate Email
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {emails.map((email) => {
                        const status = statusConfig[email.status];
                        const StatusIcon = status.icon;

                        return (
                            <div
                                key={email.id}
                                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-white truncate">
                                                {email.subject}
                                            </h3>
                                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                                            {email.body}
                                        </p>

                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            {email.contacts && (
                                                <span className="flex items-center gap-1">
                                                    <FileText className="w-3 h-3" />
                                                    {email.contacts.name}
                                                    {email.contacts.company && ` @ ${email.contacts.company}`}
                                                </span>
                                            )}
                                            {email.meetings && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {email.meetings.title}
                                                </span>
                                            )}
                                            <span>{formatDate(email.created_at)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        {email.status === 'draft' && (
                                            <button
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                title="Send email"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(email.id)}
                                            disabled={deleting === email.id}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Delete email"
                                        >
                                            {deleting === email.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
