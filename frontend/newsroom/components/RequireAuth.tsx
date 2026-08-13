"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/AuthProvider";

/** Client-side gate for dashboard pages. Real enforcement is server-side RBAC
 * (backend/app/core/permissions.py) -- this only avoids flashing protected UI. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return <div className="px-6 py-16 text-neutral-500">Loading…</div>;
  }

  return <>{children}</>;
}
