"use client";

import { useState } from "react";

export function Tabs({ items }: { items: { label: string; content: React.ReactNode }[] }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="tabs" role="tablist">
        {items.map((t, j) => (
          <button key={t.label} type="button" role="tab" aria-selected={i === j} aria-current={i === j} onClick={() => setI(j)} className="tab">{t.label}</button>
        ))}
      </div>
      <div role="tabpanel">{items[i]?.content}</div>
    </div>
  );
}
