import { Command } from "lucide-react";
import Link from "next/link";

export function AuthHeader() {
  return (
    <header className="flex items-center gap-2 p-6">
      <Link href="/" className="flex items-center gap-2">
        <Command className="h-6 w-6 text-white" />
        <span className="text-lg font-medium text-white">Rubic</span>
      </Link>
    </header>
  );
}
