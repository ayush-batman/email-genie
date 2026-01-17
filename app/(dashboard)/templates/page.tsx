'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    FileText, Plus, Trash2, Loader2, Copy, Check,
    Briefcase, Heart, Zap, MessageSquare
} from 'lucide-react';

interface Template {
    id: string;
    name: string;
    subject: string;
    body: string;
    tone: string;
    category: string;
    created_at: string;
}

const toneIcons: Record<string, typeof Briefcase> = {
    professional: Briefcase,
    friendly: Heart,
    urgent: Zap,
    casual: MessageSquare,
};

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates || []);
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        setDeleting(id);
        try {
            const response = await fetch('/api/templates', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (response.ok) {
                setTemplates(templates.filter(t => t.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
        } finally {
            setDeleting(null);
        }
    };

    const handleCopy = async (template: Template) => {
        await navigator.clipboard.writeText(`Subject: ${template.subject}\n\n${template.body}`);
        setCopiedId(template.id);
        setTimeout(() => setCopiedId(null), 2000);
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
                    <h1 className="text-3xl font-bold text-white mb-2">Email Templates</h1>
                    <p className="text-slate-400">
                        Save and reuse your best follow-up email templates
                    </p>
                </div>
                <Link
                    href="/templates/new"
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 
                   text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                    New Template
                </Link>
            </div>

            {templates.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No templates yet</h3>
                    <p className="text-slate-400 mb-6">
                        Create your first email template to speed up follow-ups
                    </p>
                    <Link
                        href="/templates/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {templates.map((template) => {
                        const ToneIcon = toneIcons[template.tone] || Briefcase;

                        return (
                            <div
                                key={template.id}
                                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <ToneIcon className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">{template.name}</h3>
                                            <p className="text-xs text-slate-500 capitalize">{template.tone} • {template.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleCopy(template)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Copy template"
                                        >
                                            {copiedId === template.id ? (
                                                <Check className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(template.id)}
                                            disabled={deleting === template.id}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Delete template"
                                        >
                                            {deleting === template.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm">
                                        <span className="text-slate-500">Subject: </span>
                                        <span className="text-slate-300">{template.subject}</span>
                                    </div>
                                    <p className="text-sm text-slate-400 line-clamp-3">
                                        {template.body}
                                    </p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                    <Link
                                        href={`/emails/new?template=${template.id}`}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        Use this template →
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
