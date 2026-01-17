/**
 * Google Calendar API Client
 * Handles OAuth and calendar event fetching
 */

const GOOGLE_API_BASE = 'https://www.googleapis.com';
const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleTokens {
    access_token: string;
    refresh_token: string;
    expires_at: Date;
}

export interface GoogleCalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    hangoutLink?: string;
    conferenceData?: {
        conferenceId: string;
        conferenceSolution: {
            name: string;
            iconUri: string;
        };
        entryPoints: Array<{
            entryPointType: string;
            uri: string;
        }>;
    };
    attendees?: Array<{
        email: string;
        displayName?: string;
        responseStatus: string;
    }>;
}

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

    const scopes = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
    ];

    const params = new URLSearchParams({
        client_id: clientId!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent', // Force refresh token
    });

    return `${GOOGLE_OAUTH_BASE}/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange Google code: ${error}`);
    }

    const data = await response.json();

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Refresh Google access token
 */
export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh Google token: ${error}`);
    }

    const data = await response.json();

    return {
        access_token: data.access_token,
        refresh_token: refreshToken, // Google doesn't return new refresh token
        expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Fetch calendar events with video meetings
 */
export async function fetchGoogleMeetings(
    accessToken: string,
    timeMin?: string,
    timeMax?: string
): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
        maxResults: '50',
        singleEvents: 'true',
        orderBy: 'startTime',
    });

    if (timeMin) params.set('timeMin', timeMin);
    if (timeMax) params.set('timeMax', timeMax);

    const response = await fetch(
        `${GOOGLE_API_BASE}/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch Google Calendar events: ${error}`);
    }

    const data = await response.json();
    const events: GoogleCalendarEvent[] = data.items || [];

    // Filter to only include events with Google Meet or other video links
    return events.filter(event =>
        event.hangoutLink ||
        event.conferenceData?.conferenceSolution?.name === 'Google Meet'
    );
}

/**
 * Get attendee names from event
 */
export function getEventAttendees(event: GoogleCalendarEvent): string[] {
    if (!event.attendees) return [];
    return event.attendees
        .filter(a => a.responseStatus !== 'declined')
        .map(a => a.displayName || a.email);
}
