import Link from "next/link";

export function AuthFooter() {
  return (
    <footer className="flex flex-col items-center gap-4 pb-8">
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <span>from</span>
        <span className="font-semibold text-neutral-400">Etheon</span>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <Link
          href="/terms"
          className="text-neutral-400 underline hover:text-white"
        >
          Terms of service
        </Link>
        <Link
          href="/privacy"
          className="text-neutral-400 underline hover:text-white"
        >
          Privacy policy
        </Link>
        <span className="text-neutral-500">
          {new Date().getFullYear()} Rubic
        </span>
      </div>
    </footer>
  );
}
