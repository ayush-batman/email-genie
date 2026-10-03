import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSite } from "@/lib/auth.ts";
import { ask, askConfigured } from "@/lib/ask.ts";

const body = z.object({
  question: z.string().trim().min(2).max(1000),
  history: z.array(z.object({ q: z.string().max(1000), a: z.string().max(4000) })).max(10).default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  if (!askConfigured()) return Response.json({ error: "Ask isn't configured on this server. Set ANTHROPIC_API_KEY to enable it." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask a question (2–1000 characters)." }, { status: 400 });
  try {
    return Response.json(await ask(site, site.org_id, parsed.data.question, parsed.data.history));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Too many questions right now. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "The server's Anthropic API key is invalid." }, { status: 503 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: `The assistant is unavailable (${e.status}).` }, { status: 502 });
    console.error("ask failed", e);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
