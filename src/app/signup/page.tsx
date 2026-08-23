import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      subtitle="Set up your Student Hub login."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-neutral-900 dark:text-neutral-100 underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
