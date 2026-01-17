'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Video, Globe, ArrowLeft, Check, Loader2, FileText, CalendarDays } from 'lucide-react';
import Link from 'next/link';

interface ImportableMeeting {
    id: string;
    externalId: string;
    title: string;
    date: string;
    source: 'zoom' | 'google_meet';
    hasTranscript?: boolean;
    attendees?: string[];
    meetLink?: string;
}

export default function ImportMeetingsPage() {
    const searchParams = useSearchParams();
    const sourceFilter = searchParams.get('source');

    const [meetings, setMeetings] = useState<ImportableMeeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchMeetings();
    }, [sourceFilter]);

    const fetchMeetings = async () => {
        setLoading(true);
        setError(null);

        try {
            const sources = sourceFilter ? [sourceFilter] : ['zoom', 'google'];
            const allMeetings: ImportableMeeting[] = [];

            for (const source of sources) {
                const response = await fetch(`/api/integrations/${source}/meetings`);
                if (response.ok) {
                    const data = await response.json();
                    allMeetings.push(...data.meetings);
                }
            }

            // Sort by date descending
            allMeetings.sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setMeetings(allMeetings);
        } catch (err) {
            setError('Failed to fetch meetings');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === meetings.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(meetings.map(m => m.id)));
        }
    };

    const handleImport = async () => {
        setImporting(true);
        const imported = new Set(importedIds);

        for (const meeting of meetings.filter(m => selectedIds.has(m.id))) {
            try {
                const source = meeting.source === 'zoom' ? 'zoom' : 'google';
                const response = await fetch(`/api/integrations/${source}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        meetingId: meeting.externalId,
                        title: meeting.title,
                        date: meeting.date,
                    }),
                });

                if (response.ok) {
                    imported.add(meeting.id);
                }
            } catch (err) {
                console.error('Failed to import meeting:', meeting.id);
            }
        }

        setImportedIds(imported);
        setSelectedIds(new Set());
        setImporting(false);
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

    const getSourceIcon = (source: string) => {
        return source === 'zoom' ? Video : Globe;
    };

    const getSourceColor = (source: string) => {
        return source === 'zoom' ? 'text-blue-400' : 'text-red-400';
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <Link
                    href="/meetings"
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Meetings
                </Link>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Import Meetings</h1>
                        <p className="text-slate-400">
                            Select meetings from Zoom or Google Meet to import
                        </p>
                    </div>

                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 
                       text-white font-medium rounded-lg hover:opacity-90 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
                        >
                            {importing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Import {selectedIds.size} meeting{selectedIds.size !== 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>

            {/* Source Filter Tabs */}
            <div className="flex gap-2 mb-6">
                <Link
                    href="/meetings/import"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!sourceFilter
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                >
                    All Sources
                </Link>
                <Link
                    href="/meetings/import?source=zoom"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${sourceFilter === 'zoom'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                >
                    <Video className="w-4 h-4" />
                    Zoom
                </Link>
                <Link
                    href="/meetings/import?source=google"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${sourceFilter === 'google'
                            ? 'bg-red-500/20 text-red-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                >
                    <Globe className="w-4 h-4" />
                    Google Meet
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : error ? (
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                        onClick={fetchMeetings}
                        className="text-blue-400 hover:text-blue-300"
                    >
                        Try again
                    </button>
                </div>
            ) : meetings.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">No meetings found</p>
                    <p className="text-sm text-slate-500">
                        Connect your accounts in{' '}
                        <Link href="/settings/integrations" className="text-blue-400 hover:underline">
                            Settings → Integrations
                        </Link>
                    </p>
                </div>
            ) : (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selectedIds.size === meetings.length && meetings.length > 0}
                            onChange={selectAll}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 
                       text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-slate-400">
                            {selectedIds.size > 0
                                ? `${selectedIds.size} selected`
                                : `${meetings.length} meetings`}
                        </span>
                    </div>

                    {/* Meeting List */}
                    <div className="divide-y divide-slate-700/50">
                        {meetings.map((meeting) => {
                            const SourceIcon = getSourceIcon(meeting.source);
                            const isImported = importedIds.has(meeting.id);

                            return (
                                <div
                                    key={meeting.id}
                                    className={`px-4 py-3 flex items-center gap-4 transition-colors ${isImported
                                            ? 'bg-green-500/5'
                                            : selectedIds.has(meeting.id)
                                                ? 'bg-slate-700/30'
                                                : 'hover:bg-slate-700/20'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(meeting.id)}
                                        onChange={() => toggleSelect(meeting.id)}
                                        disabled={isImported}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 
                             text-blue-500 focus:ring-blue-500 focus:ring-offset-0
                             disabled:opacity-50"
                                    />

                                    <SourceIcon className={`w-5 h-5 ${getSourceColor(meeting.source)}`} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium truncate">
                                                {meeting.title}
                                            </span>
                                            {meeting.hasTranscript && (
                                                <span className="flex items-center gap-1 text-xs text-emerald-400 
                                       bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                                    <FileText className="w-3 h-3" />
                                                    Transcript
                                                </span>
                                            )}
                                            {isImported && (
                                                <span className="flex items-center gap-1 text-xs text-green-400 
                                       bg-green-400/10 px-2 py-0.5 rounded-full">
                                                    <Check className="w-3 h-3" />
                                                    Imported
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-400 mt-0.5">
                                            {formatDate(meeting.date)}
                                            {meeting.attendees && meeting.attendees.length > 0 && (
                                                <span className="ml-2">
                                                    • {meeting.attendees.slice(0, 2).join(', ')}
                                                    {meeting.attendees.length > 2 && ` +${meeting.attendees.length - 2}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
