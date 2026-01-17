// Environment variables type definitions
declare namespace NodeJS {
    interface ProcessEnv {
        // Supabase
        NEXT_PUBLIC_SUPABASE_URL: string;
        NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
        SUPABASE_SERVICE_ROLE_KEY?: string;

        // Gemini AI
        GEMINI_API_KEY: string;

        // Zoom Integration
        ZOOM_CLIENT_ID?: string;
        ZOOM_CLIENT_SECRET?: string;

        // Google Integration
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;

        // Stripe
        STRIPE_SECRET_KEY?: string;
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
        STRIPE_WEBHOOK_SECRET?: string;

        // App
        NEXT_PUBLIC_APP_URL: string;
    }
}
