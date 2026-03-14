"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: user } = await sb.from("users").select("role").eq("id", session.user.id).single();
      if (!user) { router.replace("/login"); return; }
      if (user.role === "admin") router.replace("/admin/dashboard");
      else if (user.role === "authority") router.replace("/authority/dashboard");
      else router.replace("/citizen/dashboard");
    })();
  }, [router]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "linear-gradient(135deg, #E0F2FE, #E8F4FD, #F0F7FF)" }}>
      <div className="spinner" />
    </div>
  );
}
