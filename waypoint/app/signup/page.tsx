import { AuthForm } from "@/components/auth-form.tsx";
import { signup } from "../actions.ts";

export const metadata = { title: "Sign up" };
export default function Page() {
  return <AuthForm mode="signup" action={signup} />;
}
