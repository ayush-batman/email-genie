import { AuthForm } from "@/components/auth-form.tsx";
import { login } from "../actions.ts";

export const metadata = { title: "Log in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="login" action={login} next={sp.next} email={sp.email} note={sp.next?.startsWith("/invite/") ? "Log in to accept your team invitation." : undefined} />;
}
