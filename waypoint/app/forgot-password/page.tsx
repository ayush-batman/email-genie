import { SimpleForm } from "@/components/simple-form.tsx";
import { requestPasswordReset } from "../actions.ts";

export const metadata = { title: "Reset password" };
export default function Page() {
  return <SimpleForm action={requestPasswordReset} title="Reset your password" description="We'll email you a link to choose a new one." submit="Send reset link"
    field={{ name: "email", label: "Email", type: "email", autoComplete: "email" }} done="If an account exists for that email, a reset link is on its way. It works for one hour." />;
}
