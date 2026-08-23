import { AuthCard } from "@/components/AuthCard";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      subtitle="You're verified — set a new password for your account."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
