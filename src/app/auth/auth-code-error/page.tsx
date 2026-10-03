import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="page-shell flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Authentication Error
        </h1>
        <p className="text-text-muted text-sm mb-6">
          The sign-in link may have expired or been used already. Please try signing in again.
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 bg-accent-primary text-white rounded-xl text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
