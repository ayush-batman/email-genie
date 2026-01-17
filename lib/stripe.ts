/**
 * Stripe Client Configuration
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is not set. Stripe features will not work.');
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-12-15.clover',
    })
    : null;

export const PRICE_IDS = {
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
};

export const PLANS = {
    free: {
        name: 'Free',
        price: 0,
        features: [
            '10 emails per month',
            'Basic AI generation',
            'Manual transcript input',
        ],
    },
    pro: {
        name: 'Pro',
        price: 19,
        priceYearly: 190,
        features: [
            'Unlimited emails',
            'Advanced AI generation',
            'Zoom & Google Meet integration',
            'Email templates',
            'Priority support',
        ],
    },
};
