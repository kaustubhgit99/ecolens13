"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@/lib/types";

const NAV: Record<string, { section: string; items: { icon: string; label: string; href: string }[] }[]> = {
  citizen: [{ section: "Citizen", items: [
    { icon: "📊", label: "Dashboard",     href: "/citizen/dashboard" },
    { icon: "📝", label: "Report Issue",  href: "/citizen/report" },
    { icon: "📋", label: "My Complaints", href: "/citizen/complaints" },
    { icon: "🗺️", label: "Thermomap",    href: "/citizen/map" },
    { icon: "🏆", label: "Leaderboard",   href: "/citizen/leaderboard" },
    { icon: "🪙", label: "EcoWallet",     href: "/citizen/coins" },
  ]}],
  authority: [{ section: "Authority", items: [
    { icon: "🏛️", label: "Dashboard",          href: "/authority/dashboard" },
    { icon: "📥", label: "Complaint Queue",     href: "/authority/queue" },
    { icon: "🗺️", label: "Heatmap",            href: "/authority/heatmap" },
    { icon: "📈", label: "Analytics",           href: "/authority/analytics" },
    { icon: "📁", label: "Resolution History",  href: "/authority/history" },
  ]}],
  admin: [{ section: "Admin", items: [
    { icon: "🏙️", label: "City Metrics",       href: "/admin/dashboard" },
    { icon: "🏢", label: "Dept Performance",    href: "/admin/departments" },
    { icon: "👥", label: "Citizen Engagement",  href: "/admin/engagement" },
  ]}],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data } = await sb.from("users").select("*").eq("id", session.user.id).single();
      if (!data) { router.replace("/login"); return; }
      setUser(data as User);
      setLoading(false);
    })();
  }, [router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    router.replace("/login");
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <div className="spinner" />
    </div>
  );
  if (!user) return null;

  const sections = NAV[user.role] ?? NAV.citizen;
  const initials = user.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const roleBadgeColors: Record<string, { bg: string; color: string; border: string }> = {
    citizen: { bg: "#E0F2FE", color: "#0EA5E9", border: "#BAE6FD" },
    authority: { bg: "#EDE9FE", color: "#7C3AED", border: "#DDD6FE" },
    admin: { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  };
  const roleBadge = roleBadgeColors[user.role] ?? roleBadgeColors.citizen;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay open"
          onClick={() => setSidebarOpen(false)}
          style={{ display: "block" }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: 250,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          boxShadow: "4px 0 20px rgba(163, 199, 224, 0.2)",
          position: sidebarOpen ? "fixed" : undefined,
          top: sidebarOpen ? 0 : undefined,
          left: sidebarOpen ? 0 : undefined,
          bottom: sidebarOpen ? 0 : undefined,
          zIndex: sidebarOpen ? 1000 : undefined,
          transform: !sidebarOpen ? undefined : "translateX(0)",
          transition: "transform .3s ease",
        }}
        className={typeof window !== "undefined" && window.innerWidth <= 1024 && !sidebarOpen ? "sidebar-hidden" : ""}
      >
        {/* Logo */}
        <div style={{ padding: "18px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
          }}>🌿</div>
          <span style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
            Eco<span style={{ color: "var(--primary)" }}>Lens</span>
          </span>
        </div>

        {/* Role badge */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            background: roleBadge.bg, border: `1px solid ${roleBadge.border}`,
            borderRadius: 10, padding: "6px 12px", fontSize: 11, fontWeight: 700,
            color: roleBadge.color, textAlign: "center", textTransform: "uppercase",
            letterSpacing: ".06em",
          }}>{user.role}</div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          {sections.map(sec => (
            <div key={sec.section} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: "var(--text3)",
                letterSpacing: ".08em", textTransform: "uppercase",
                padding: "4px 10px 8px",
              }}>{sec.section}</div>
              {sec.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 12, marginBottom: 2,
                      background: active ? "var(--primarybg)" : "transparent",
                      color: active ? "var(--primary)" : "var(--text2)",
                      fontWeight: active ? 600 : 500,
                      boxShadow: active ? "0 2px 8px rgba(14, 165, 233, 0.12)" : "none",
                      transition: "all .2s ease",
                    }}>
                      <span style={{ width: 20, textAlign: "center", fontSize: 16 }}>{item.icon}</span>
                      <span style={{ fontSize: 13 }}>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: 12, cursor: "pointer",
            width: "100%", background: "none", border: "none",
            color: "var(--text2)", fontSize: 13, fontFamily: "inherit",
            transition: "all .15s",
          }}>
            <span style={{ width: 20, textAlign: "center" }}>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 60, background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12,
          boxShadow: "0 2px 10px rgba(163, 199, 224, 0.15)",
        }}>
          {/* Hamburger */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Amravati Municipal Corporation</span>
          </div>

          {user.role === "citizen" && (
            <Link href="/citizen/coins" style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "#FEF3C7", border: "1px solid #FDE68A",
                borderRadius: 20, padding: "5px 12px",
                fontSize: 12, fontWeight: 700, color: "#D97706",
                boxShadow: "2px 2px 6px rgba(245, 158, 11, 0.15)",
              }}>
                🪙 {user.coins_total}
              </div>
            </Link>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>{user.full_name}</span>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "white",
              boxShadow: "0 3px 10px rgba(14, 165, 233, 0.3)",
            }}>{initials}</div>
            <button onClick={handleLogout} title="Sign Out" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)", cursor: "pointer",
              color: "var(--text2)", fontSize: 14,
              transition: "all .2s", boxShadow: "var(--clay-shadow-sm)",
            }}>🚪</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 1200 }} className="page-enter">{children}</div>
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1024px) {
          aside { position: fixed !important; top: 0 !important; left: 0 !important; bottom: 0 !important; z-index: 1000 !important; transform: translateX(${sidebarOpen ? '0' : '-100%'}) !important; }
        }
        @media (max-width: 768px) {
          aside { width: 260px !important; }
        }
        @media (max-width: 480px) {
          aside { width: 85vw !important; }
        }
      `}</style>
    </div>
  );
}
