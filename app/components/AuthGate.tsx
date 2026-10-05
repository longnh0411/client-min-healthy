"use client";

// Route guard client-side (port từ client-mim-trading): chưa login → đá về /login.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/session";

export default function AuthGate() {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);
  return null;
}
