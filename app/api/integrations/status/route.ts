/**
 * Integrations Status API Route
 * Returns the connection status of all integrations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasIntegration } from '@/lib/integrations/token-manager';

export async function GET() {
    // Check if integrations are configured (doesn't require auth)
    const zoomConfigured = !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
    const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    // Check connection status (requires auth)
    let zoomConnected = false;
    let googleConnected = false;

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            [zoomConnected, googleConnected] = await Promise.all([
                hasIntegration(user.id, 'zoom'),
                hasIntegration(user.id, 'google'),
            ]);
        }
    } catch (error) {
        console.error('Failed to check integration connections:', error);
    }

    return NextResponse.json({
        zoom: {
            connected: zoomConnected,
            configured: zoomConfigured,
        },
        google: {
            connected: googleConnected,
            configured: googleConfigured,
        },
    });
}
