import { visitorName } from "@/lib/names.ts";

const HUES = [262, 200, 160, 24, 330, 290, 120, 45];

export function VisitorAvatar({ id, size = 32 }: { id: string; size?: number }) {
  const name = visitorName(id);
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 55% 35%)` }}
    >
      {name.split(" ").map((w) => w[0]).join("")}
    </span>
  );
}
