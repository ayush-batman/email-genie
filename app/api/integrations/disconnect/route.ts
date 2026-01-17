/**
 * Disconnect Integration API Route
 * Removes an integration connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteIntegration, type IntegrationProvider } from '@/lib/integrations/token-manager';

export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await request.json();

    if (!provider || !['zoom', 'google'].includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    try {
        await deleteIntegration(user.id, provider as IntegrationProvider);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to disconnect integration:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect' },
            { status: 500 }
        );
    }
}
