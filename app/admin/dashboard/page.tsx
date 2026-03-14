"use client";
import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint } from "@/lib/types";
import { Chart, BarController, LineController, PieController, BarElement, LineElement, ArcElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from "chart.js";
Chart.register(BarController,LineController,PieController,BarElement,LineElement,ArcElement,PointElement,CategoryScale,LinearScale,Filler,Tooltip,Legend);

export default function AdminDashboard() {
  const deptRef = useRef<HTMLCanvasElement>(null);
  const pieRef  = useRef<HTMLCanvasElement>(null);
  const momRef  = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("complaints").select("department,status,ai_category,ai_priority,created_at,resolved_at");
      setComplaints((data ?? []) as Complaint[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    chartsRef.current.forEach(c => c.destroy()); chartsRef.current = [];

    const gridColor = "rgba(208,229,245,0.5)";
    const tickColor = "#94A3B8";

    const DEPTS = [
      { code:"PWD", name:"Public Works" },{ code:"SAN", name:"Sanitation" },
      { code:"DRN", name:"Drainage" },{ code:"WTR", name:"Water Supply" },
      { code:"ELC", name:"Electricity" },{ code:"GEN", name:"General Admin" },
    ];
    const deptAssigned = DEPTS.map(d => complaints.filter(c => c.department === d.code).length);
    const deptResolved = DEPTS.map(d => complaints.filter(c => c.department === d.code && c.status === "resolved").length);
    if (deptRef.current) chartsRef.current.push(new Chart(deptRef.current, {
      type: "bar",
      data: { labels: DEPTS.map(d => d.name.length > 10 ? d.name.slice(0,10)+"…" : d.name), datasets: [
        { label: "Assigned", data: deptAssigned, backgroundColor: "rgba(14,165,233,.5)", borderRadius: 6 },
        { label: "Resolved", data: deptResolved, backgroundColor: "rgba(22,163,74,.5)", borderRadius: 6 },
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: tickColor, font: { size: 10 }, padding: 8 } } }, scales: { x: { ticks: { color: tickColor, font: { size: 9 } }, grid: { color: gridColor } }, y: { ticks: { color: tickColor, font: { size: 10 } }, beginAtZero: true, grid: { color: gridColor } } } },
    }));

    const CATS = ["Road Damage","Garbage","Sewage","Lighting","Water Supply","Noise","Other"];
    const catData = CATS.map(cat => complaints.filter(c => (c.ai_category ?? "Other") === cat || (cat === "Other" && !CATS.slice(0,-1).includes(c.ai_category ?? ""))).length);
    if (pieRef.current) chartsRef.current.push(new Chart(pieRef.current, {
      type: "pie",
      data: { labels: CATS, datasets: [{ data: catData, backgroundColor: ["#0EA5E9","#16A34A","#8B5CF6","#F59E0B","#14B8A6","#EF4444","#94A3B8"], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: tickColor, font: { size: 10 }, padding: 8 } } } },
    }));

    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return d; });
    const submitted = months.map(m => complaints.filter(c => { const cd = new Date(c.created_at); return cd.getMonth() === m.getMonth() && cd.getFullYear() === m.getFullYear(); }).length);
    const resolved = months.map(m => complaints.filter(c => { if (!c.resolved_at) return false; const rd = new Date(c.resolved_at); return rd.getMonth() === m.getMonth() && rd.getFullYear() === m.getFullYear(); }).length);
    if (momRef.current) chartsRef.current.push(new Chart(momRef.current, {
      type: "line",
      data: { labels: months.map(d => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })), datasets: [
        { label: "Submitted", data: submitted, borderColor: "#0EA5E9", tension: .4, pointRadius: 3 },
        { label: "Resolved",  data: resolved,  borderColor: "#16A34A", tension: .4, pointRadius: 3 },
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: tickColor, font: { size: 10 }, padding: 8 } } }, scales: { x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } }, y: { ticks: { color: tickColor, font: { size: 10 } }, beginAtZero: true, grid: { color: gridColor } } } },
    }));

    return () => chartsRef.current.forEach(c => c.destroy());
  }, [loading, complaints]);

  const resolved = complaints.filter(c => c.status === "resolved").length;
  const inProg   = complaints.filter(c => c.status === "in_progress" || c.status === "routed").length;

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 22, marginBottom: 4, color: "var(--text)" }}>Amravati City Metrics</h2>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>AMC Executive Overview · {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        </div>
        <button className="btn btn-secondary">Download Report</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: String(complaints.length), color: "var(--text)" },
          { label: "Resolved", value: String(resolved), color: "#16A34A" },
          { label: "In Progress", value: String(inProg), color: "var(--blue)" },
          { label: "Pending", value: String(complaints.filter(c => c.status === "pending").length), color: "var(--amber)" },
          { label: "Resolution %", value: `${complaints.length ? Math.round(resolved/complaints.length*100) : 0}%`, color: "#16A34A" },
        ].map(s => (
          <div key={s.label} className="card-sm">
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-syne)", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12, color: "var(--text)" }}>Department Comparison</h3><div style={{ position: "relative", height: 240 }}><canvas ref={deptRef} /></div></div>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12, color: "var(--text)" }}>Category Breakdown</h3><div style={{ position: "relative", height: 240 }}><canvas ref={pieRef} /></div></div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12, color: "var(--text)" }}>Month-over-Month (Last 6 Months)</h3>
        <div style={{ position: "relative", height: 180 }}><canvas ref={momRef} /></div>
      </div>
    </DashboardLayout>
  );
}
