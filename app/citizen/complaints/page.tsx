"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint, ComplaintStatus } from "@/lib/types";
import { CATEGORY_EMOJI } from "@/lib/types";

const FILTERS: { key: ComplaintStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "routed", label: "Routed" },
  { key: "resolved", label: "Resolved" },
  { key: "rejected_spam", label: "Rejected" },
];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"all" | ComplaintStatus>("all");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    setUserId(session.user.id);
    const { data } = await sb
      .from("complaints")
      .select("*")
      .eq("citizen_id", session.user.id)
      .order("created_at", { ascending: false });
    setComplaints((data ?? []) as Complaint[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const sb = createClient();
    const channel = sb
      .channel("my-complaints-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints", filter: `citizen_id=eq.${userId}` },
        () => { load(); }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [userId, load]);

  const filtered = filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    active: complaints.filter((c) => c.status === "in_progress" || c.status === "routed").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  };

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20, marginBottom: 4, color: "var(--text)" }}>My Complaints</h2>
          <p style={{ fontSize: 12, color: "var(--text3)" }}>Real-time synced with database</p>
        </div>
        <Link href="/citizen/report"><button className="btn btn-primary">+ New Report</button></Link>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total", value: stats.total, color: "var(--primary)" },
          { label: "Pending", value: stats.pending, color: "var(--amber)" },
          { label: "Active", value: stats.active, color: "var(--blue)" },
          { label: "Resolved", value: stats.resolved, color: "#16A34A" },
        ].map((s) => (
          <div key={s.label} className="card-sm" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-syne)", fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <div key={f.key} className={`filter-chip ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key as "all" | ComplaintStatus)}>
            {f.label}
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", boxShadow: "0 0 6px #16A34A", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#16A34A" }}>LIVE</span>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>· Updates automatically</span>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p>No complaints found.</p>
          <Link href="/citizen/report"><button className="btn btn-primary" style={{ marginTop: 12 }}>Report your first issue</button></Link>
        </div>
      ) : (
        filtered.map((c) => (
          <Link key={c.id} href={`/citizen/complaints/${c.id}`} style={{ textDecoration: "none" }}>
            <div className="card" style={{
              display: "flex", gap: 14, padding: 16,
              marginBottom: 12, cursor: "pointer",
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "var(--clay-shadow-sm)" }}>
                {CATEGORY_EMOJI[c.ai_category ?? ""] ?? "❓"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-syne)", fontSize: 14, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
                  {c.title}
                </div>
                {c.description && (
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>
                    {c.description}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--text3)" }}>{c.id.slice(0, 8).toUpperCase()}</span>
                  {c.ward && <> · {c.ward}</>}
                  {c.ai_category && <> · {c.ai_category}</>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <StatusBadge status={c.status} />
                  <PriorityBadge priority={c.ai_priority} />
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
          Showing {filtered.length} of {complaints.length} complaints
        </div>
      )}
    </DashboardLayout>
  );
}
