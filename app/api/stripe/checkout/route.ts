/**
 * Stripe Checkout API
 * Creates checkout sessions for subscription upgrades
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
    if (!stripe) {
        return NextResponse.json(
            { error: 'Stripe not configured' },
            { status: 500 }
        );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, interval } = await request.json();

    // Default to monthly if not specified
    const selectedPriceId = priceId ||
        (interval === 'yearly' ? PRICE_IDS.pro_yearly : PRICE_IDS.pro_monthly);

    if (!selectedPriceId) {
        return NextResponse.json(
            { error: 'Price not configured. Please set STRIPE_PRO_MONTHLY_PRICE_ID in environment.' },
            { status: 500 }
        );
    }

    try {
        // Get or create Stripe customer
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        let customerId = subscription?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { user_id: user.id },
            });
            customerId = customer.id;

            // Save customer ID
            await supabase
                .from('subscriptions')
                .update({ stripe_customer_id: customerId })
                .eq('user_id', user.id);
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: selectedPriceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=subscribed`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
            metadata: {
                user_id: user.id,
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
