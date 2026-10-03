import { SimpleForm } from "@/components/simple-form.tsx";
import { resetPassword } from "../../actions.ts";

export const metadata = { title: "Choose a new password" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SimpleForm action={resetPassword.bind(null, token)} title="Choose a new password" description="You'll be signed out of other devices." submit="Save password"
    field={{ name: "password", label: "New password", type: "password", autoComplete: "new-password" }} />;
}
