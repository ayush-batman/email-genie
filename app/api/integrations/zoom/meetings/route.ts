/**
 * Zoom Meetings API Route
 * Fetches user's meetings with recordings from Zoom
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchZoomRecordings, getZoomRecordingDetails } from '@/lib/integrations/zoom';
import { getValidAccessToken } from '@/lib/integrations/token-manager';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(user.id, 'zoom');

    if (!accessToken) {
        return NextResponse.json(
            { error: 'Zoom not connected', needsAuth: true },
            { status: 401 }
        );
    }

    try {
        // Fetch recordings from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const meetings = await fetchZoomRecordings(
            accessToken,
            thirtyDaysAgo.toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        );

        // Format meetings for frontend
        const formattedMeetings = meetings.map(meeting => ({
            id: meeting.uuid,
            externalId: meeting.id.toString(),
            title: meeting.topic,
            date: meeting.start_time,
            duration: meeting.duration,
            source: 'zoom' as const,
            hasRecording: meeting.recording_count > 0,
            hasTranscript: meeting.recording_files?.some(
                f => f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript'
            ) || false,
        }));

        return NextResponse.json({ meetings: formattedMeetings });
    } catch (error) {
        console.error('Failed to fetch Zoom meetings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch meetings' },
            { status: 500 }
        );
    }
}
