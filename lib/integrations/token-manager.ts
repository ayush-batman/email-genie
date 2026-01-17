/**
 * Token Manager
 * Handles storing, retrieving, and refreshing OAuth tokens
 */

import { createClient } from '@/lib/supabase/server';
import { refreshZoomToken, type ZoomTokens } from './zoom';
import { refreshGoogleToken, type GoogleTokens } from './google';

export type IntegrationProvider = 'zoom' | 'google';

export interface StoredIntegration {
    id: string;
    user_id: string;
    provider: IntegrationProvider;
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
    account_id?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Get integration tokens for a user
 */
export async function getIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<StoredIntegration | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

    if (error || !data) {
        return null;
    }

    return data as StoredIntegration;
}

/**
 * Save or update integration tokens
 */
export async function saveIntegration(
    userId: string,
    provider: IntegrationProvider,
    tokens: { access_token: string; refresh_token: string; expires_at: Date },
    accountId?: string
): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('integrations')
        .upsert({
            user_id: userId,
            provider,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokens.expires_at.toISOString(),
            account_id: accountId,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,provider',
        });

    if (error) {
        throw new Error(`Failed to save integration: ${error.message}`);
    }
}

/**
 * Delete integration
 */
export async function deleteIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

    if (error) {
        throw new Error(`Failed to delete integration: ${error.message}`);
    }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(
    userId: string,
    provider: IntegrationProvider
): Promise<string | null> {
    const integration = await getIntegration(userId, provider);

    if (!integration) {
        return null;
    }

    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();

    // If token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        try {
            let newTokens: ZoomTokens | GoogleTokens;

            if (provider === 'zoom') {
                newTokens = await refreshZoomToken(integration.refresh_token);
            } else {
                newTokens = await refreshGoogleToken(integration.refresh_token);
            }

            await saveIntegration(userId, provider, newTokens, integration.account_id);
            return newTokens.access_token;
        } catch (error) {
            console.error(`Failed to refresh ${provider} token:`, error);
            // Delete invalid integration
            await deleteIntegration(userId, provider);
            return null;
        }
    }

    return integration.access_token;
}

/**
 * Check if user has connected integration
 */
export async function hasIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<boolean> {
    const integration = await getIntegration(userId, provider);
    return integration !== null;
}
