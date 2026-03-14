"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint, ComplaintStatus, Priority } from "@/lib/types";

export default function QueuePage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState<string>("all");
  const [priorityF, setPriorityF] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("complaints")
      .select("*,citizen:citizen_id(full_name,ward)")
      .order("created_at", { ascending: false });
    setComplaints((data ?? []) as Complaint[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("authority-queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => { load(); })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [load]);

  const updateStatus = async (id: string, status: ComplaintStatus) => {
    setUpdating(id);
    const sb = createClient();
    const update: Record<string, unknown> = { status };
    if (status === "resolved") update.resolved_at = new Date().toISOString();
    await sb.from("complaints").update(update).eq("id", id);
    await load();
    setUpdating(null);
  };

  let filtered = [...complaints];
  if (statusF !== "all") filtered = filtered.filter((c) => c.status === statusF);
  if (priorityF !== "all") filtered = filtered.filter((c) => c.ai_priority === priorityF);
  if (search)
    filtered = filtered.filter(
      (c) =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.id.slice(0, 8).toLowerCase().includes(search.toLowerCase()) ||
        c.ward?.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
    );

  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    inProgress: complaints.filter((c) => c.status === "in_progress" || c.status === "routed").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  };

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20, marginBottom: 4, color: "var(--text)" }}>Complaint Queue</h2>
          <p style={{ fontSize: 12, color: "var(--text3)" }}>Real-time synced · {complaints.length} total complaints</p>
        </div>
        <input className="input" placeholder="Search title, ID, ward..." style={{ width: 260, maxWidth: "100%" }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total", value: stats.total, color: "var(--text)" },
          { label: "Pending", value: stats.pending, color: "var(--amber)" },
          { label: "In Progress", value: stats.inProgress, color: "var(--blue)" },
          { label: "Resolved", value: stats.resolved, color: "#16A34A" },
        ].map((s) => (
          <div key={s.label} className="card-sm" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-syne)", fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>STATUS:</span>
        {["all", "pending", "routed", "in_progress", "resolved", "rejected"].map((f) => (
          <div key={f} className={`filter-chip ${statusF === f ? "active" : ""}`} onClick={() => setStatusF(f)}>
            {{ all: "All", pending: "Pending", routed: "Routed", in_progress: "In Progress", resolved: "Resolved", rejected: "Rejected" }[f]}
          </div>
        ))}
        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginLeft: 8 }}>PRIORITY:</span>
        {["all", "Critical", "High", "Moderate", "Medium", "Low"].map((f) => (
          <div key={f} className={`filter-chip ${priorityF === f ? "active" : ""}`} onClick={() => setPriorityF(f)}>
            {f === "all" ? "All" : f}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", boxShadow: "0 0 6px #16A34A", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#16A34A" }}>LIVE SYNCED</span>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>· Auto-updates when complaints change</span>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>No complaints match the current filters</div>
        ) : (
          <>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Title</th><th>Ward</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11 }}>{c.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{c.title}</td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>{c.ward}</td>
                      <td style={{ fontSize: 12 }}>{c.ai_category}</td>
                      <td><PriorityBadge priority={c.ai_priority as Priority} /></td>
                      <td><StatusBadge status={c.status as ComplaintStatus} /></td>
                      <td style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/citizen/complaints/${c.id}`}><button className="btn btn-ghost btn-sm">View</button></Link>
                          {c.status === "pending" && (
                            <button className="btn btn-secondary btn-sm" disabled={updating === c.id} onClick={() => updateStatus(c.id, "in_progress" as ComplaintStatus)}>
                              {updating === c.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Start"}
                            </button>
                          )}
                          {(c.status === "in_progress" || c.status === "routed") && (
                            <button className="btn btn-primary btn-sm" disabled={updating === c.id} onClick={() => updateStatus(c.id, "resolved" as ComplaintStatus)}>
                              {updating === c.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Resolve"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text2)" }}>Showing {filtered.length} of {complaints.length} complaints</div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
