/**
 * Usage Tracking Utility
 * Track and enforce email generation limits
 */

import { createClient } from '@/lib/supabase/server';

interface UsageLimits {
    free: { emailsPerMonth: number };
    pro: { emailsPerMonth: number };
    enterprise: { emailsPerMonth: number };
}

const PLAN_LIMITS: UsageLimits = {
    free: { emailsPerMonth: 10 },
    pro: { emailsPerMonth: 1000 },
    enterprise: { emailsPerMonth: -1 }, // unlimited
};

function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface UsageInfo {
    emailsGenerated: number;
    emailsSent: number;
    limit: number;
    plan: string;
    canGenerate: boolean;
    remaining: number;
}

/**
 * Get current usage for a user
 */
export async function getUsage(userId: string): Promise<UsageInfo> {
    const supabase = await createClient();
    const month = getCurrentMonth();

    // Get user's subscription plan
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single();

    const plan = subscription?.plan || 'free';
    const limit = PLAN_LIMITS[plan as keyof UsageLimits]?.emailsPerMonth || 10;

    // Get current month's usage
    const { data: usage } = await supabase
        .from('usage_tracking')
        .select('emails_generated, emails_sent')
        .eq('user_id', userId)
        .eq('month', month)
        .single();

    const emailsGenerated = usage?.emails_generated || 0;
    const emailsSent = usage?.emails_sent || 0;

    return {
        emailsGenerated,
        emailsSent,
        limit,
        plan,
        canGenerate: limit === -1 || emailsGenerated < limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - emailsGenerated),
    };
}

/**
 * Increment email generated count
 */
export async function incrementEmailGenerated(userId: string): Promise<boolean> {
    const supabase = await createClient();
    const month = getCurrentMonth();

    // First check if user can generate
    const usage = await getUsage(userId);
    if (!usage.canGenerate) {
        return false;
    }

    // Upsert usage record
    const { error } = await supabase
        .from('usage_tracking')
        .upsert({
            user_id: userId,
            month,
            emails_generated: (usage.emailsGenerated || 0) + 1,
            emails_sent: usage.emailsSent || 0,
        }, {
            onConflict: 'user_id,month',
        });

    if (error) {
        console.error('Failed to increment usage:', error);
        return false;
    }

    return true;
}

/**
 * Increment email sent count
 */
export async function incrementEmailSent(userId: string): Promise<void> {
    const supabase = await createClient();
    const month = getCurrentMonth();

    const usage = await getUsage(userId);

    await supabase
        .from('usage_tracking')
        .upsert({
            user_id: userId,
            month,
            emails_generated: usage.emailsGenerated || 0,
            emails_sent: (usage.emailsSent || 0) + 1,
        }, {
            onConflict: 'user_id,month',
        });
}

/**
 * Check if user can generate more emails
 */
export async function canGenerateEmail(userId: string): Promise<boolean> {
    const usage = await getUsage(userId);
    return usage.canGenerate;
}
