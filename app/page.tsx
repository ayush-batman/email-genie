import Link from "next/link";
import {
  Sparkles,
  Zap,
  Video,
  Mail,
  Users,
  BarChart3,
  ArrowRight,
  Check,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--background))]/80 backdrop-blur-sm border-b border-[hsl(var(--border))]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[hsl(var(--primary))] flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">EmailGenie</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-md bg-[hsl(var(--primary))] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Powered by Gemini AI
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Turn meetings into
            <br />
            <span className="text-[hsl(var(--primary))]">perfect follow-ups</span>
          </h1>

          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-xl mx-auto mb-8">
            Connect Zoom & Google Meet. Auto-transcribe calls.
            Let AI craft personalized emails that close deals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-md bg-[hsl(var(--primary))] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-md border border-[hsl(var(--border))] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <Video className="w-4 h-4" />
              Watch Demo
            </Link>
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No credit card required • 5 free emails/month
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Everything you need to close more deals
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: Video,
                title: "Auto-Transcribe",
                description: "Connect Zoom & Meet. Capture every conversation.",
              },
              {
                icon: Sparkles,
                title: "AI Emails",
                description: "Personalized follow-ups that sound like you.",
              },
              {
                icon: Users,
                title: "Built-in CRM",
                description: "Contacts, meetings, and follow-ups in one place.",
              },
              {
                icon: Zap,
                title: "One-Click Send",
                description: "Review, edit, send. No copy-pasting.",
              },
              {
                icon: BarChart3,
                title: "Track Opens",
                description: "Know when emails are opened and clicked.",
              },
              {
                icon: Mail,
                title: "Templates",
                description: "Save your best emails for reuse.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]"
              >
                <feature.icon className="w-5 h-5 text-[hsl(var(--muted-foreground))] mb-3" strokeWidth={1.5} />
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 bg-[hsl(var(--card))]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Connect calendar",
                description: "Link Zoom or Google Meet. We detect and transcribe meetings.",
              },
              {
                step: "2",
                title: "AI generates email",
                description: "Our AI analyzes the conversation and creates a follow-up.",
              },
              {
                step: "3",
                title: "Review & send",
                description: "Make tweaks if needed, then send or schedule.",
              },
            ].map((item, index) => (
              <div key={index}>
                <div className="text-4xl font-bold text-[hsl(var(--primary))] opacity-30 mb-2">
                  {item.step}
                </div>
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Simple pricing
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: "Free",
                price: "$0",
                description: "For trying out",
                features: ["5 meetings/month", "10 emails", "20 contacts"],
              },
              {
                name: "Pro",
                price: "$29/mo",
                description: "For sales professionals",
                features: ["100 meetings/month", "500 emails", "1,000 contacts", "Integrations"],
                popular: true,
              },
              {
                name: "Enterprise",
                price: "$99/mo",
                description: "For teams",
                features: ["Unlimited", "Team collaboration", "Priority support"],
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`p-5 rounded-lg border ${plan.popular
                    ? "bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/30"
                    : "bg-[hsl(var(--card))] border-[hsl(var(--border))]"
                  }`}
              >
                <h3 className="font-medium">{plan.name}</h3>
                <div className="text-2xl font-bold my-2">{plan.price}</div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                  {plan.description}
                </p>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full py-2 rounded-md text-center text-sm font-medium transition-colors ${plan.popular
                      ? "bg-[hsl(var(--primary))] text-white hover:opacity-90"
                      : "border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                    }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">
            Ready to transform your follow-ups?
          </h2>
          <p className="text-[hsl(var(--muted-foreground))] mb-6">
            Join sales professionals closing more deals with AI.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[hsl(var(--border))]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[hsl(var(--primary))] flex items-center justify-center">
              <Mail className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium">EmailGenie</span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            © 2025 EmailGenie
          </p>
        </div>
      </footer>
    </div>
  );
}
