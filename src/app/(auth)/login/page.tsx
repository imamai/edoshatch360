import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Sign in to see how your birds are doing.
      </p>

      <div className="mt-7">
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-brand" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        New to Hatch360?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
