'use client';

import { useState, useEffect } from 'react';
import { Video, Globe, Check, X, Loader2, ExternalLink } from 'lucide-react';

interface IntegrationStatus {
    zoom: { connected: boolean; configured: boolean };
    google: { connected: boolean; configured: boolean };
}

export default function IntegrationsPage() {
    const [status, setStatus] = useState<IntegrationStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/integrations/status');
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch integration status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = (provider: 'zoom' | 'google') => {
        window.location.href = `/api/integrations/${provider}/authorize`;
    };

    const handleDisconnect = async (provider: 'zoom' | 'google') => {
        if (!confirm(`Are you sure you want to disconnect ${provider === 'zoom' ? 'Zoom' : 'Google'}?`)) {
            return;
        }

        setDisconnecting(provider);
        try {
            const response = await fetch('/api/integrations/disconnect', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });

            if (response.ok) {
                fetchStatus();
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
        } finally {
            setDisconnecting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const integrations = [
        {
            id: 'zoom',
            name: 'Zoom',
            description: 'Import meetings and transcripts from Zoom cloud recordings',
            icon: Video,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-500/10',
            connected: status?.zoom.connected || false,
            configured: status?.zoom.configured || false,
        },
        {
            id: 'google',
            name: 'Google Calendar',
            description: 'Import Google Meet events from your calendar',
            icon: Globe,
            color: 'from-red-500 to-yellow-500',
            bgColor: 'bg-red-500/10',
            connected: status?.google.connected || false,
            configured: status?.google.configured || false,
        },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
                <p className="text-slate-400">
                    Connect your meeting platforms to automatically import meetings and transcripts
                </p>
            </div>

            <div className="grid gap-6">
                {integrations.map((integration) => (
                    <div
                        key={integration.id}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${integration.bgColor}`}>
                                    <integration.icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-semibold text-white">
                                            {integration.name}
                                        </h3>
                                        {integration.connected && (
                                            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                                                <Check className="w-3 h-3" />
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm max-w-md">
                                        {integration.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {integration.connected ? (
                                    <button
                                        onClick={() => handleDisconnect(integration.id as 'zoom' | 'google')}
                                        disabled={disconnecting === integration.id}
                                        className="px-4 py-2 text-sm font-medium text-red-400 bg-red-400/10 
                               hover:bg-red-400/20 rounded-lg transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center gap-2"
                                    >
                                        {disconnecting === integration.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <X className="w-4 h-4" />
                                        )}
                                        Disconnect
                                    </button>
                                ) : integration.configured ? (
                                    <button
                                        onClick={() => handleConnect(integration.id as 'zoom' | 'google')}
                                        className={`px-4 py-2 text-sm font-medium text-white 
                               bg-gradient-to-r ${integration.color}
                               hover:opacity-90 rounded-lg transition-opacity
                               flex items-center gap-2`}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Connect
                                    </button>
                                ) : (
                                    <span className="text-xs text-slate-500 bg-slate-700/50 px-3 py-1.5 rounded-lg">
                                        Not configured
                                    </span>
                                )}
                            </div>
                        </div>

                        {integration.connected && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                <a
                                    href={`/meetings/import?source=${integration.id}`}
                                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    Import meetings from {integration.name}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Setup Instructions */}
            <div className="mt-8 p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-3">Setup Instructions</h3>
                <div className="text-sm text-slate-400 space-y-3">
                    <p>
                        To enable integrations, you need to configure OAuth credentials in your environment:
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg font-mono text-xs">
                        <p className="text-slate-500"># Zoom OAuth</p>
                        <p>ZOOM_CLIENT_ID=your_zoom_client_id</p>
                        <p>ZOOM_CLIENT_SECRET=your_zoom_client_secret</p>
                        <p className="mt-2 text-slate-500"># Google OAuth</p>
                        <p>GOOGLE_CLIENT_ID=your_google_client_id</p>
                        <p>GOOGLE_CLIENT_SECRET=your_google_client_secret</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
