/**
 * Usage API - Get current user's usage stats
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsage } from '@/lib/usage';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const usage = await getUsage(user.id);
        return NextResponse.json(usage);
    } catch (error) {
        console.error('Failed to get usage:', error);
        return NextResponse.json({ error: 'Failed to get usage' }, { status: 500 });
    }
}
