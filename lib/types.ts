// Database types for Supabase tables

export interface User {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    created_at: string;
}

export interface Contact {
    id: string;
    user_id: string;
    name: string;
    email?: string;
    company?: string;
    role?: string;
    phone?: string;
    notes?: string;
    created_at: string;
    updated_at?: string;
}

export interface Meeting {
    id: string;
    user_id: string;
    contact_id?: string;
    title: string;
    date?: string;
    source: 'zoom' | 'google_meet' | 'manual';
    transcript?: string;
    summary?: string;
    external_id?: string; // Zoom meeting ID or Google Meet ID
    recording_url?: string;
    created_at: string;
    updated_at?: string;
    // Joined data
    contact?: Contact;
}

export interface GeneratedEmail {
    id: string;
    user_id: string;
    meeting_id?: string;
    contact_id?: string;
    subject: string;
    body: string;
    key_points?: string[];
    status: 'draft' | 'sent' | 'scheduled';
    sent_at?: string;
    scheduled_for?: string;
    created_at: string;
    // Joined data
    meeting?: Meeting;
    contact?: Contact;
}

export interface Subscription {
    id: string;
    user_id: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    current_period_start?: string;
    current_period_end?: string;
    created_at: string;
}

export interface UsageStats {
    meetings_this_month: number;
    emails_generated_this_month: number;
    contacts_count: number;
}

// Plan limits
export const PLAN_LIMITS = {
    free: {
        meetings_per_month: 5,
        emails_per_month: 10,
        contacts: 20,
        integrations: false,
        team_members: 1,
    },
    pro: {
        meetings_per_month: 100,
        emails_per_month: 500,
        contacts: 1000,
        integrations: true,
        team_members: 5,
    },
    enterprise: {
        meetings_per_month: -1, // unlimited
        emails_per_month: -1,
        contacts: -1,
        integrations: true,
        team_members: -1,
    },
} as const;
