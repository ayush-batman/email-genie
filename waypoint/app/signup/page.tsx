import { AuthForm } from "@/components/auth-form.tsx";
import { signup } from "../actions.ts";

export const metadata = { title: "Sign up" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="signup" action={signup} next={sp.next} email={sp.email} note={sp.next?.startsWith("/invite/") ? "Create an account to join the team you were invited to." : undefined} />;
}
