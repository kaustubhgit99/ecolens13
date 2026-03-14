"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint } from "@/lib/types";

export default function HistoryPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("complaints").select("*,citizen:citizen_id(full_name)").eq("status","resolved").order("resolved_at",{ascending:false});
      setComplaints((data ?? []) as Complaint[]);
      setLoading(false);
    })();
  }, []);

  const filtered = search ? complaints.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()) || c.id.slice(0,8).toLowerCase().includes(search.toLowerCase())) : complaints;

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20 }}>Resolution History</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="Search..." style={{ width: 200 }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Ward</th><th>Resolved</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>No resolved complaints found.</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11 }}>{c.id.slice(0,8).toUpperCase()}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{c.title}</td>
                      <td style={{ fontSize: 12 }}>{c.ai_category}</td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>{c.ward}</td>
                      <td style={{ fontSize: 12 }}>{c.resolved_at ? new Date(c.resolved_at).toLocaleDateString("en-IN") : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text2)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.resolution_notes ?? "—"}</td>
                      <td><Link href={`/citizen/complaints/${c.id}`}><button className="btn btn-ghost btn-sm">View</button></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text2)" }}>{filtered.length} resolved complaints</div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
