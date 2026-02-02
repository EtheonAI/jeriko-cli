"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page is deprecated - redirect to unified login page
export default function PasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
