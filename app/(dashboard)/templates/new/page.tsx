'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function NewTemplatePage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        name: '',
        subject: '',
        body: '',
        tone: 'professional',
        category: 'general',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (response.ok) {
                router.push('/templates');
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to save template');
            }
        } catch (err) {
            setError('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <Link
                href="/templates"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Templates
            </Link>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Create Template</h1>
                <p className="text-slate-400">
                    Save a reusable email template for quick follow-ups
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-5">
                    {/* Template Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Template Name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g., Post-Demo Follow-up"
                            required
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg 
                       text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Tone & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Tone
                            </label>
                            <select
                                value={form.tone}
                                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg 
                         text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="professional">Professional</option>
                                <option value="friendly">Friendly</option>
                                <option value="casual">Casual</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Category
                            </label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg 
                         text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="general">General</option>
                                <option value="sales">Sales</option>
                                <option value="demo">Demo Follow-up</option>
                                <option value="meeting">Meeting Summary</option>
                                <option value="proposal">Proposal</option>
                            </select>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Email Subject
                        </label>
                        <input
                            type="text"
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            placeholder="e.g., Following up on our conversation"
                            required
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg 
                       text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Email Body
                        </label>
                        <textarea
                            value={form.body}
                            onChange={(e) => setForm({ ...form, body: e.target.value })}
                            placeholder="Write your email template here..."
                            required
                            rows={12}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg 
                       text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            Tip: Use placeholders like [Name], [Company], [Meeting Date] for personalization
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 
                     text-white font-medium rounded-lg hover:opacity-90 transition-opacity
                     disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Template
                    </button>
                </div>
            </form>
        </div>
    );
}
