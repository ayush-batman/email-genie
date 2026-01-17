/**
 * Zoom OAuth Authorization Route
 * Redirects user to Zoom for OAuth consent
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getZoomAuthUrl } from '@/lib/integrations/zoom';

export async function GET() {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));
    }

    // Check if Zoom credentials are configured
    if (!process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
        return NextResponse.json(
            { error: 'Zoom integration not configured' },
            { status: 500 }
        );
    }

    // Redirect to Zoom OAuth
    const authUrl = getZoomAuthUrl();
    return NextResponse.redirect(authUrl);
}
