import { AuthForm } from "@/components/auth-form.tsx";
import { login } from "../actions.ts";

export const metadata = { title: "Log in" };
export default function Page() {
  return <AuthForm mode="login" action={login} />;
}
