import Link from "next/link";
import { currentUser } from "@/lib/auth.ts";

const FEATURES: [string, string, boolean][] = [
  ["See live activity", "Visitors online right now and a real-time stream of pageviews and events as they happen.", true],
  ["Know where visitors come from", "Channels, referrers, UTM campaigns and AI assistants like ChatGPT and Perplexity, classified automatically.", true],
  ["Turn actions into reports", "Track signups, clicks and purchases with one line of JS or a data attribute, then break them down by any property.", true],
  ["Analytics without cookies", "Private mode needs no cookies and no device storage. Product mode recognises returning visitors when you need it.", true],
  ["Share a dashboard", "Publish a read-only link for investors, clients or your team, and export any table to CSV.", true],
  ["Find where people leave", "Funnels with step-by-step drop-off and time-to-convert.", false],
  ["Connect revenue and results", "Stripe, Lemon Squeezy, Polar and Paddle payments attributed to the source that drove them.", false],
  ["Ask your analytics", "An MCP server so Claude, Cursor and other AI tools can answer questions about your traffic.", false],
  ["Keep your history", "Import from Umami, Databuddy and Vercel Analytics.", false],
];

export default async function Landing() {
  const user = await currentUser();
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5">
        <span className="font-semibold">◆ Waypoint</span>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/share/demo" className="text-muted hover:text-fg">Demo</Link>
          {user ? <Link href="/sites" className="btn">Dashboard</Link> : <><Link href="/login" className="text-muted hover:text-fg">Log in</Link><Link href="/signup" className="btn">Start free trial</Link></>}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Know where visitors come from, where they leave, and what turns into revenue.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">Privacy-friendly web analytics for founders and small teams. One script tag, no cookies required, live in under a minute.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn px-5 py-2.5 text-base">Start 7-day free trial</Link>
            <Link href="/share/demo" className="btn-ghost px-5 py-2.5 text-base">Explore demo</Link>
          </div>
          <p className="mt-3 text-xs text-muted">No credit card required.</p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body, live]) => (
              <li key={title} className="panel p-5">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{title}</h2>
                  {!live && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">Soon</span>}
                </div>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-24">
          <div className="panel p-6">
            <h2 className="font-medium">Install in one line</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs"><code>{`<script defer src="https://your-waypoint/w.js" data-site="YOUR_SITE_ID"></script>`}</code></pre>
            <p className="mt-3 text-sm text-muted">Then <code>waypoint.track("signup", {"{ plan: \"pro\" }"})</code> for anything that matters.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">© {new Date().getFullYear()} Waypoint</footer>
    </>
  );
}
