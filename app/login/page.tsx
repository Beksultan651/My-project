"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The provider shows the login form until a session is established.
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
