/**
 * Google Meetings API Route
 * Fetches user's Google Meet events from Calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchGoogleMeetings, getEventAttendees } from '@/lib/integrations/google';
import { getValidAccessToken } from '@/lib/integrations/token-manager';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(user.id, 'google');

    if (!accessToken) {
        return NextResponse.json(
            { error: 'Google not connected', needsAuth: true },
            { status: 401 }
        );
    }

    try {
        // Fetch meetings from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const events = await fetchGoogleMeetings(
            accessToken,
            thirtyDaysAgo.toISOString(),
            new Date().toISOString()
        );

        // Format meetings for frontend
        const formattedMeetings = events.map(event => ({
            id: event.id,
            externalId: event.id,
            title: event.summary || 'Google Meet',
            date: event.start.dateTime || event.start.date,
            source: 'google_meet' as const,
            meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
            attendees: getEventAttendees(event),
            // Google Calendar doesn't provide transcripts directly
            hasTranscript: false,
        }));

        return NextResponse.json({ meetings: formattedMeetings });
    } catch (error) {
        console.error('Failed to fetch Google meetings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch meetings' },
            { status: 500 }
        );
    }
}
