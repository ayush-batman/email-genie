// Classifies a visit's acquisition channel from its referrer, UTM params and click IDs.
// Keep this table-driven so it is easy to extend and to unit-test.

export const CHANNELS = [
  "Direct",
  "Organic Search",
  "Paid Search",
  "Organic Social",
  "Paid Social",
  "Email",
  "Referral",
  "AI Assistants",
  "Affiliates",
  "Display",
  "Other",
] as const;
export type Channel = (typeof CHANNELS)[number];

const SEARCH = [
  "google.", "bing.com", "duckduckgo.com", "search.yahoo.com", "yahoo.com", "yandex.", "baidu.com",
  "ecosia.org", "search.brave.com", "startpage.com", "qwant.com", "naver.com", "seznam.cz", "kagi.com",
];
const SOCIAL = [
  "facebook.com", "fb.com", "m.facebook.com", "l.facebook.com", "instagram.com", "l.instagram.com",
  "twitter.com", "t.co", "x.com", "linkedin.com", "lnkd.in", "reddit.com", "old.reddit.com",
  "youtube.com", "youtu.be", "tiktok.com", "pinterest.com", "threads.net", "bsky.app", "mastodon.social",
  "news.ycombinator.com", "producthunt.com", "quora.com", "discord.com", "telegram.org", "t.me",
  "whatsapp.com", "snapchat.com", "tumblr.com", "medium.com", "indiehackers.com",
];
const AI = [
  "chatgpt.com", "chat.openai.com", "perplexity.ai", "claude.ai", "gemini.google.com", "bard.google.com",
  "copilot.microsoft.com", "you.com", "phind.com", "poe.com", "meta.ai", "chat.deepseek.com", "grok.com",
  "chat.mistral.ai",
];
const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com", "mail.proton.me"];

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsearch|paid_search|paid-search|cpm|cpv|cpa|sem)$/;
const SOCIAL_MEDIUMS = /^(social|social-network|social-media|sm|social_network|social_media)$/;
const PAID_SOCIAL_MEDIUMS = /^(paid_social|paid-social|paidsocial|social_paid|social-paid)$/;
const DISPLAY_MEDIUMS = /^(display|banner|expandable|interstitial|cpm)$/;

function matches(domain: string, list: string[]): boolean {
  return list.some((d) => (d.endsWith(".") ? domain.startsWith(d) || domain.includes("." + d) : domain === d || domain.endsWith("." + d)));
}

export interface ChannelInput {
  referrerDomain: string; // "" for direct
  utmSource?: string;
  utmMedium?: string;
  clickIdType?: string; // gclid | fbclid | msclkid | ttclid | li_fat_id | ""
}

export function classifyChannel(input: ChannelInput): Channel {
  const domain = input.referrerDomain.toLowerCase().replace(/^www\./, "");
  const source = (input.utmSource ?? "").toLowerCase();
  const medium = (input.utmMedium ?? "").toLowerCase();
  const click = input.clickIdType ?? "";

  if (medium === "email" || medium === "e-mail" || medium === "newsletter" || source === "newsletter") return "Email";
  if (medium === "affiliate" || medium === "affiliates" || medium === "partner") return "Affiliates";
  if (PAID_SOCIAL_MEDIUMS.test(medium)) return "Paid Social";
  if (click === "fbclid" && PAID_MEDIUMS.test(medium)) return "Paid Social";
  if (click === "ttclid" || click === "li_fat_id") return "Paid Social";
  if (PAID_MEDIUMS.test(medium)) {
    if (matches(domain, SOCIAL) || matches(source, SOCIAL) || ["facebook", "instagram", "linkedin", "twitter", "x", "tiktok", "reddit"].includes(source)) return "Paid Social";
    if (DISPLAY_MEDIUMS.test(medium) && medium !== "cpc") return "Display";
    return "Paid Search";
  }
  if (click === "gclid" || click === "msclkid") return "Paid Search";
  if (DISPLAY_MEDIUMS.test(medium)) return "Display";
  if (SOCIAL_MEDIUMS.test(medium)) return "Organic Social";

  const sourceDomain = source.replace(/^www\./, "");
  if (matches(domain, AI) || matches(sourceDomain, AI) || ["chatgpt", "perplexity", "claude", "gemini", "copilot"].includes(source)) return "AI Assistants";
  if (matches(domain, EMAIL)) return "Email";
  if (matches(domain, SEARCH) || ["google", "bing", "duckduckgo", "yahoo", "ecosia", "brave"].includes(source)) return "Organic Search";
  if (matches(domain, SOCIAL) || ["facebook", "instagram", "linkedin", "twitter", "x", "reddit", "youtube", "tiktok", "hackernews", "hn", "producthunt"].includes(source)) return "Organic Social";
  if (!domain && !source) return "Direct";
  if (domain) return "Referral";
  return "Other";
}

export function referrerDomain(referrer: string, ownHostname: string): string {
  if (!referrer) return "";
  try {
    const u = new URL(referrer);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const own = ownHostname.toLowerCase().replace(/^www\./, "");
    if (host === own) return ""; // internal navigation
    if (u.protocol === "android-app:") return u.hostname;
    return host;
  } catch {
    return "";
  }
}
