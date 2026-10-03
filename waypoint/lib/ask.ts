// "Ask your analytics": Claude answers questions about one site using the same read-only tools as the MCP server.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Site } from "./db.ts";
import { runTool, ToolError, TOOLS } from "./tools.ts";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 8;

export const askConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// list_sites is pointless inside a single-site panel.
const tools: Anthropic.Beta.BetaTool[] = TOOLS.filter((t) => t.name !== "list_sites").map((t) => {
  const { $schema: _s, ...schema } = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  return { name: t.name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
});

export type AskResult = { answer: string; tools: string[] };

export async function ask(site: Site, orgId: string, question: string, history: { q: string; a: string }[]): Promise<AskResult> {
  const client = new Anthropic();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: site.timezone });
  const system = `You are the analytics assistant inside Waypoint, answering questions about the website ${site.domain} (site_id "${site.public_id}", timezone ${site.timezone}, revenue currency ${site.currency}, ${site.mode} mode). Today is ${today}.
Use the tools to look up real numbers before answering; never guess figures. Revenue amounts from tools are integers in minor units: divide by 100 (except zero-decimal currencies like JPY) and format them as money. Rates are fractions: show them as percentages.
Answer in a few short sentences or a compact bulleted list, lead with the direct answer, and mention the date range you used. If the data can't answer the question, say so and suggest what to track.`;

  const context = history.slice(-4).map((h) => `Earlier question: ${h.q}\nYour earlier answer: ${h.a}`).join("\n\n");
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: context ? `${context}\n\nNew question: ${question}` : question }];
  const used: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" }, // chat-style lookups; raise for harder analysis
      system,
      tools,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // if a request is declined, the API retries on a suitable model
    });
    messages.push({ role: "assistant", content: res.content }); // append-only: keep every block as returned
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

    if (res.stop_reason === "refusal") return { answer: "I can't help with that question.", tools: used };
    if (res.stop_reason === "pause_turn") continue;
    if (res.stop_reason !== "tool_use") return { answer: text || "I couldn't find an answer.", tools: used };

    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        used.push(c.name);
        const t = TOOLS.find((x) => x.name === c.name);
        try {
          if (!t) throw new ToolError(400, `Unknown tool ${c.name}`);
          return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(await runTool(t, { orgId }, c.input)) };
        } catch (e) {
          const msg = e instanceof ToolError ? e.message : "Tool failed";
          if (!(e instanceof ToolError)) console.error("ask tool failed", e);
          return { type: "tool_result", tool_use_id: c.id, content: msg, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results }); // all results in one message
  }
  return { answer: "That took too many steps. Try a more specific question.", tools: used };
}
