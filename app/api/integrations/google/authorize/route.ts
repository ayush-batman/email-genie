/**
 * Google OAuth Authorization Route
 * Redirects user to Google for OAuth consent
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAuthUrl } from '@/lib/integrations/google';

export async function GET() {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));
    }

    // Check if Google credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return NextResponse.json(
            { error: 'Google integration not configured' },
            { status: 500 }
        );
    }

    // Redirect to Google OAuth
    const authUrl = getGoogleAuthUrl();
    return NextResponse.redirect(authUrl);
}
