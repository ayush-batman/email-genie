"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        const supabase = createClient();

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    };

    const handleGoogleSignup = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--background))]">
                <div className="absolute inset-0 dot-pattern opacity-30" />
                <div className="relative w-full max-w-md text-center">
                    <div className="p-8 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                            <Mail className="w-8 h-8 text-green-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
                        <p className="text-[hsl(var(--muted-foreground))] mb-6">
                            We&apos;ve sent a confirmation link to{" "}
                            <span className="font-medium text-[hsl(var(--foreground))]">
                                {email}
                            </span>
                        </p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Click the link in the email to activate your account.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--background))]">
            {/* Background effects */}
            <div className="absolute inset-0 dot-pattern opacity-30" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold gradient-text">EmailGenie</span>
                    </Link>
                </div>

                {/* Card */}
                <div className="p-8 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl">
                    <h1 className="text-2xl font-bold mb-2 text-center">
                        Create Your Account
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] text-center mb-8">
                        Start closing more deals with AI-powered follow-ups
                    </p>

                    {/* Google Sign Up */}
                    <button
                        onClick={handleGoogleSignup}
                        className="w-full py-3 px-4 rounded-xl border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors flex items-center justify-center gap-3 mb-6"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[hsl(var(--border))]" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-[hsl(var(--card))] text-sm text-[hsl(var(--muted-foreground))]">
                                or continue with email
                            </span>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSignup} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--accent))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] transition-colors outline-none"
                                />
                            </div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Must be at least 6 characters
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 btn-shine disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-xs text-center text-[hsl(var(--muted-foreground))] mt-4">
                        By signing up, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>

                <p className="text-center mt-6 text-[hsl(var(--muted-foreground))]">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="text-[hsl(var(--primary))] hover:underline font-medium"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
