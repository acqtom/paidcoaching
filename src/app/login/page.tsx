import Link from "next/link";
import { AuthCard, FormNotice } from "@/components/AuthCard";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; reset?: string }>;
}) {
  const { redirectTo, reset } = await searchParams;

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back. Enter your details below."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-neutral-900 dark:text-neutral-100 underline"
          >
            Sign up
          </Link>
          <br />
          Have a team secret key instead?{" "}
          <Link
            href="/team-access"
            className="font-medium text-neutral-900 dark:text-neutral-100 underline"
          >
            Enter it here
          </Link>
        </>
      }
    >
      {reset === "success" && (
        <div className="mb-4">
          <FormNotice message="Password updated. Log in with your new password." />
        </div>
      )}
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  );
}
