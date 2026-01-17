/**
 * Zoom Sync/Import Route
 * Imports a specific meeting with transcript to our database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getZoomRecordingDetails,
    downloadZoomTranscript,
    parseVttTranscript
} from '@/lib/integrations/zoom';
import { getValidAccessToken } from '@/lib/integrations/token-manager';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meetingId, title, date } = await request.json();

    if (!meetingId) {
        return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(user.id, 'zoom');

    if (!accessToken) {
        return NextResponse.json(
            { error: 'Zoom not connected' },
            { status: 401 }
        );
    }

    try {
        // Get recording details
        const recordingDetails = await getZoomRecordingDetails(accessToken, meetingId);

        // Find transcript file
        const transcriptFile = recordingDetails.recording_files?.find(
            f => f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript'
        );

        let transcript = '';

        if (transcriptFile) {
            // Download and parse transcript
            const rawTranscript = await downloadZoomTranscript(
                accessToken,
                transcriptFile.download_url
            );
            transcript = parseVttTranscript(rawTranscript);
        }

        // Check if meeting already exists
        const { data: existingMeeting } = await supabase
            .from('meetings')
            .select('id')
            .eq('user_id', user.id)
            .eq('external_id', meetingId)
            .single();

        if (existingMeeting) {
            // Update existing meeting
            const { error } = await supabase
                .from('meetings')
                .update({
                    transcript,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingMeeting.id);

            if (error) throw error;

            return NextResponse.json({
                success: true,
                meetingId: existingMeeting.id,
                updated: true,
            });
        }

        // Create new meeting
        const { data: newMeeting, error } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: title || 'Zoom Meeting',
                date: date || new Date().toISOString(),
                source: 'zoom',
                external_id: meetingId,
                transcript,
            })
            .select('id')
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            meetingId: newMeeting.id,
            hasTranscript: !!transcript,
        });
    } catch (error) {
        console.error('Failed to import Zoom meeting:', error);
        return NextResponse.json(
            { error: 'Failed to import meeting' },
            { status: 500 }
        );
    }
}
