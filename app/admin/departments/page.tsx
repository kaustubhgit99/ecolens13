"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint, Department } from "@/lib/types";

export default function DepartmentsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selected, setSelected] = useState<string>("PWD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [{ data: c }, { data: d }] = await Promise.all([
        sb.from("complaints").select("department,status,ai_priority,created_at,resolved_at,ward"),
        sb.from("departments").select("*").eq("active", true).order("name"),
      ]);
      setComplaints((c ?? []) as Complaint[]);
      setDepartments((d ?? []) as Department[]);
      setLoading(false);
    })();
  }, []);

  const stats = (code: string) => {
    const dc = complaints.filter(c => c.department === code);
    const resolved = dc.filter(c => c.status === "resolved");
    const sla = dc.length ? Math.round(resolved.length / dc.length * 100) : 0;
    return { assigned: dc.length, resolved: resolved.length, sla };
  };

  const sel = stats(selected);
  const selDept = departments.find(d => d.code === selected);

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20 }}>Department Performance</h2>
        <select className="input" style={{ width: 220 }} value={selected} onChange={e => setSelected(e.target.value)}>
          {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Assigned", value: String(sel.assigned), color: "var(--text)" },
              { label: "Resolved", value: String(sel.resolved), color: "var(--green)" },
              { label: "Pending",  value: String(sel.assigned - sel.resolved), color: "var(--amber)" },
              { label: "SLA %",    value: `${sel.sla}%`, color: sel.sla >= 70 ? "var(--green)" : "var(--red)" },
            ].map(s => (
              <div key={s.label} className="card-sm">
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--font-syne)", fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {sel.sla < 70 && <div className="alert alert-red">⚠️ {selDept?.name} SLA below 70% — escalation recommended</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 16 }}>All Departments Overview</h3>
              {departments.map(dept => {
                const s = stats(dept.code);
                return (
                  <div key={dept.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => setSelected(dept.code)}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: dept.code === selected ? "var(--green)" : "var(--text)" }}>{dept.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>{s.assigned} assigned · {s.resolved} resolved</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.sla >= 70 ? "var(--green)" : "var(--amber)" }}>{s.sla}%</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>SLA</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 16 }}>{selDept?.name} · Complaints by Ward</h3>
              {(() => {
                const wardMap: Record<string, number> = {};
                complaints.filter(c => c.department === selected).forEach(c => {
                  const w = c.ward?.replace(/^Ward \d+ - /, "") ?? "Unknown";
                  wardMap[w] = (wardMap[w] ?? 0) + 1;
                });
                const sorted = Object.entries(wardMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
                const max = sorted[0]?.[1] ?? 1;
                return sorted.length === 0 ? <p style={{ color: "var(--text2)", fontSize: 13 }}>No data for this department.</p> : sorted.map(([ward, count]) => (
                  <div key={ward} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>{ward}</span><span style={{ color: "var(--text2)" }}>{count}</span>
                    </div>
                    <div className="progress"><div className="progress-fill" style={{ width: `${Math.round(count / max * 100)}%` }} /></div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
