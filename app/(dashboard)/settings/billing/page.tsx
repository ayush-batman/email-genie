'use client';

import { useState, useEffect } from 'react';
import {
    CreditCard, Check, Loader2, ExternalLink, Zap,
    Crown, Shield
} from 'lucide-react';

interface SubscriptionInfo {
    plan: string;
    status: string;
    current_period_end?: string;
}

interface UsageInfo {
    emailsGenerated: number;
    limit: number;
    plan: string;
    remaining: number;
}

const plans = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: '/month',
        description: 'For getting started',
        features: [
            '10 emails per month',
            'Basic AI generation',
            'Manual transcript input',
            'Email templates',
        ],
        icon: Shield,
        color: 'from-slate-500 to-slate-600',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$19',
        period: '/month',
        description: 'For power users',
        features: [
            'Unlimited emails',
            'Advanced AI generation',
            'Zoom & Google Meet integration',
            'Priority support',
            'Export data',
        ],
        icon: Crown,
        popular: true,
        color: 'from-blue-500 to-purple-600',
    },
];

export default function BillingPage() {
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [managingBilling, setManagingBilling] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [subRes, usageRes] = await Promise.all([
                fetch('/api/subscription'),
                fetch('/api/usage'),
            ]);

            if (subRes.ok) {
                const subData = await subRes.json();
                setSubscription(subData.subscription);
            }

            if (usageRes.ok) {
                const usageData = await usageRes.json();
                setUsage(usageData);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setUpgrading(true);
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval: 'monthly' }),
            });

            if (response.ok) {
                const { url } = await response.json();
                if (url) {
                    window.location.href = url;
                }
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to start checkout');
            }
        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Failed to start checkout');
        } finally {
            setUpgrading(false);
        }
    };

    const handleManageBilling = async () => {
        setManagingBilling(true);
        try {
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
            });

            if (response.ok) {
                const { url } = await response.json();
                if (url) {
                    window.location.href = url;
                }
            }
        } catch (error) {
            console.error('Portal error:', error);
        } finally {
            setManagingBilling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const currentPlan = subscription?.plan || 'free';
    const usagePercent = usage ? Math.min(100, (usage.emailsGenerated / usage.limit) * 100) : 0;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>
                <p className="text-slate-400">
                    Manage your subscription and billing
                </p>
            </div>

            {/* Current Usage */}
            {usage && currentPlan === 'free' && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            <span className="font-medium text-white">Monthly Usage</span>
                        </div>
                        <span className="text-sm text-slate-400">
                            {usage.emailsGenerated} / {usage.limit} emails
                        </span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                    {usage.remaining <= 3 && usage.remaining > 0 && (
                        <p className="mt-3 text-sm text-yellow-400">
                            Only {usage.remaining} emails left this month!
                        </p>
                    )}
                    {usage.remaining === 0 && (
                        <p className="mt-3 text-sm text-red-400">
                            You've reached your monthly limit. Upgrade to Pro for unlimited emails!
                        </p>
                    )}
                </div>
            )}

            {/* Plans */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {plans.map((plan) => {
                    const isCurrentPlan = plan.id === currentPlan;
                    const PlanIcon = plan.icon;

                    return (
                        <div
                            key={plan.id}
                            className={`relative bg-slate-800/50 border rounded-xl p-6 ${plan.popular
                                    ? 'border-blue-500/50'
                                    : 'border-slate-700/50'
                                } ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}
                        >
                            {plan.popular && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 
                               bg-gradient-to-r from-blue-500 to-purple-600 
                               text-xs font-medium text-white rounded-full">
                                    Most Popular
                                </span>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-xl bg-gradient-to-r ${plan.color}`}>
                                    <PlanIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{plan.name}</h3>
                                    <p className="text-xs text-slate-400">{plan.description}</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-white">{plan.price}</span>
                                <span className="text-slate-400">{plan.period}</span>
                            </div>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {isCurrentPlan ? (
                                <button
                                    disabled
                                    className="w-full py-3 px-4 bg-slate-700 text-slate-400 
                           rounded-lg font-medium cursor-not-allowed"
                                >
                                    Current Plan
                                </button>
                            ) : plan.id === 'pro' ? (
                                <button
                                    onClick={handleUpgrade}
                                    disabled={upgrading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 
                           text-white rounded-lg font-medium hover:opacity-90 
                           transition-opacity disabled:opacity-50 flex items-center 
                           justify-center gap-2"
                                >
                                    {upgrading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            Upgrade to Pro
                                            <ExternalLink className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            {/* Manage Billing */}
            {currentPlan === 'pro' && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-slate-400" />
                            <div>
                                <h3 className="font-medium text-white">Manage Subscription</h3>
                                <p className="text-sm text-slate-400">
                                    Update payment method, view invoices, or cancel
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleManageBilling}
                            disabled={managingBilling}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg 
                       hover:bg-slate-600 transition-colors disabled:opacity-50
                       flex items-center gap-2"
                        >
                            {managingBilling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Manage Billing
                                    <ExternalLink className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
