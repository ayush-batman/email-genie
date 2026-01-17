/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhook (no user context)
const getSupabaseAdmin = () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
};

export async function POST(request: NextRequest) {
    if (!stripe) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.metadata?.user_id;
                const subscriptionId = session.subscription as string;

                if (userId && subscriptionId) {
                    // Get subscription details
                    const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId);

                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            plan: 'pro',
                            status: 'active',
                            stripe_subscription_id: subscriptionId,
                            current_period_start: new Date((subscriptionData as any).current_period_start * 1000).toISOString(),
                            current_period_end: new Date((subscriptionData as any).current_period_end * 1000).toISOString(),
                        })
                        .eq('user_id', userId);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                const customerId = subscription.customer as string;

                const { data: sub } = await supabaseAdmin
                    .from('subscriptions')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (sub) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            status: subscription.status === 'active' ? 'active' : 'past_due',
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        })
                        .eq('id', sub.id);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                const customerId = subscription.customer as string;

                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        plan: 'free',
                        status: 'canceled',
                        stripe_subscription_id: null,
                    })
                    .eq('stripe_customer_id', customerId);
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
