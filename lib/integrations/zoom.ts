/**
 * Zoom API Client
 * Handles OAuth token refresh and API calls
 */

const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_BASE = 'https://zoom.us/oauth';

export interface ZoomTokens {
    access_token: string;
    refresh_token: string;
    expires_at: Date;
}

export interface ZoomMeeting {
    uuid: string;
    id: number;
    topic: string;
    start_time: string;
    duration: number;
    recording_count: number;
    total_size: number;
    recording_files?: ZoomRecordingFile[];
}

export interface ZoomRecordingFile {
    id: string;
    meeting_id: string;
    recording_type: string;
    file_type: string;
    file_size: number;
    download_url: string;
    status: string;
}

/**
 * Get Zoom OAuth authorization URL
 */
export function getZoomAuthUrl(): string {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId!,
        redirect_uri: redirectUri,
    });

    return `${ZOOM_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeZoomCode(code: string): Promise<ZoomTokens> {
    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${ZOOM_OAUTH_BASE}/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange Zoom code: ${error}`);
    }

    const data = await response.json();

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Refresh Zoom access token
 */
export async function refreshZoomToken(refreshToken: string): Promise<ZoomTokens> {
    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${ZOOM_OAUTH_BASE}/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh Zoom token: ${error}`);
    }

    const data = await response.json();

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Fetch user's cloud recordings from Zoom
 */
export async function fetchZoomRecordings(
    accessToken: string,
    fromDate?: string,
    toDate?: string
): Promise<ZoomMeeting[]> {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    const response = await fetch(
        `${ZOOM_API_BASE}/users/me/recordings?${params.toString()}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch Zoom recordings: ${error}`);
    }

    const data = await response.json();
    return data.meetings || [];
}

/**
 * Get recording details including transcript
 */
export async function getZoomRecordingDetails(
    accessToken: string,
    meetingId: string
): Promise<{ recording_files: ZoomRecordingFile[] }> {
    const response = await fetch(
        `${ZOOM_API_BASE}/meetings/${meetingId}/recordings`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Zoom recording details: ${error}`);
    }

    return response.json();
}

/**
 * Download transcript from Zoom
 */
export async function downloadZoomTranscript(
    accessToken: string,
    downloadUrl: string
): Promise<string> {
    // Append access token to download URL
    const urlWithToken = `${downloadUrl}?access_token=${accessToken}`;

    const response = await fetch(urlWithToken);

    if (!response.ok) {
        throw new Error('Failed to download Zoom transcript');
    }

    return response.text();
}

/**
 * Parse VTT transcript to plain text
 */
export function parseVttTranscript(vttContent: string): string {
    // Remove VTT headers and timestamps, keep just the text
    const lines = vttContent.split('\n');
    const textLines: string[] = [];

    for (const line of lines) {
        // Skip empty lines, WEBVTT header, and timestamp lines
        if (
            line.trim() === '' ||
            line.startsWith('WEBVTT') ||
            line.includes('-->') ||
            /^\d+$/.test(line.trim())
        ) {
            continue;
        }
        textLines.push(line.trim());
    }

    return textLines.join(' ');
}
