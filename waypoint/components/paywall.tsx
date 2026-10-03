import Link from "next/link";
import { Lock } from "lucide-react";

export function Paywall({ state }: { state: "trial_expired" | "canceled" }) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <div className="panel max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Lock className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-semibold">{state === "trial_expired" ? "Your free trial has ended" : "Your subscription is inactive"}</h1>
        <p className="mt-2 text-sm text-muted">{state === "trial_expired" ? "Your data is safe and we're still collecting it for a little while. Choose a plan to see your dashboards again." : "Your data is kept. Choose a plan to unlock your dashboards and resume tracking."}</p>
        <Link href="/settings/billing" className="btn mt-6">See plans</Link>
      </div>
    </main>
  );
}
