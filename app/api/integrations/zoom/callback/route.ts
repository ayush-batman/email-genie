/**
 * Zoom OAuth Callback Route
 * Handles the OAuth callback from Zoom and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeZoomCode } from '@/lib/integrations/zoom';
import { saveIntegration } from '@/lib/integrations/token-manager';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
        console.error('Zoom OAuth error:', error);
        return NextResponse.redirect(
            new URL('/settings/integrations?error=zoom_auth_failed', process.env.NEXT_PUBLIC_APP_URL)
        );
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/settings/integrations?error=no_code', process.env.NEXT_PUBLIC_APP_URL)
        );
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(
            new URL('/login', process.env.NEXT_PUBLIC_APP_URL)
        );
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeZoomCode(code);

        // Save tokens to database
        await saveIntegration(user.id, 'zoom', tokens);

        // Redirect to settings with success message
        return NextResponse.redirect(
            new URL('/settings/integrations?success=zoom_connected', process.env.NEXT_PUBLIC_APP_URL)
        );
    } catch (err) {
        console.error('Failed to exchange Zoom code:', err);
        return NextResponse.redirect(
            new URL('/settings/integrations?error=zoom_token_exchange_failed', process.env.NEXT_PUBLIC_APP_URL)
        );
    }
}
