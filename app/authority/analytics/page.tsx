"use client";
import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint } from "@/lib/types";
import { Chart, BarController, LineController, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from "chart.js";
Chart.register(BarController,LineController,BarElement,LineElement,PointElement,CategoryScale,LinearScale,Filler,Tooltip,Legend);

export default function AnalyticsPage() {
  const timeRef = useRef<HTMLCanvasElement>(null);
  const catRef  = useRef<HTMLCanvasElement>(null);
  const histRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("complaints").select("ai_category,ai_priority,status,created_at,resolved_at,updated_at").order("created_at", { ascending: false });
      setComplaints((data ?? []) as Complaint[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    chartsRef.current.forEach(c => c.destroy()); chartsRef.current = [];

    // Last 14 days
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
    const submitted = days.map(d => complaints.filter(c => new Date(c.created_at).toDateString() === d.toDateString()).length);
    if (timeRef.current) chartsRef.current.push(new Chart(timeRef.current, {
      type: "line",
      data: { labels: days.map(d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })), datasets: [{ label: "Submitted", data: submitted, borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,.1)", tension: .4, fill: true, pointRadius: 2, pointBackgroundColor: "#22C55E" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#8B9BB4", font: { size: 9 }, maxRotation: 45 } }, y: { ticks: { color: "#8B9BB4", font: { size: 10 } }, beginAtZero: true } } },
    }));

    // By category
    const CATS = ["Road Damage","Garbage","Sewage","Lighting","Water Supply","Noise","Air Quality","Other"];
    const catData = CATS.map(cat => complaints.filter(c => c.ai_category === cat).length);
    if (catRef.current) chartsRef.current.push(new Chart(catRef.current, {
      type: "bar",
      data: { labels: CATS.map(c => c.length > 8 ? c.slice(0,8)+"…" : c), datasets: [{ data: catData, backgroundColor: ["#3B82F6","#22C55E","#8B5CF6","#F59E0B","#14B8A6","#EF4444","#F97316","#6B7280"], borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#8B9BB4", font: { size: 9 } } }, y: { ticks: { color: "#8B9BB4", font: { size: 10 } }, beginAtZero: true } } },
    }));

    // Priority breakdown
    const prioData = [complaints.filter(c=>c.ai_priority==="High").length, complaints.filter(c=>c.ai_priority==="Medium").length, complaints.filter(c=>c.ai_priority==="Low").length];
    if (histRef.current) chartsRef.current.push(new Chart(histRef.current, {
      type: "bar",
      data: { labels: ["High","Medium","Low"], datasets: [{ data: prioData, backgroundColor: ["#EF4444","#F59E0B","#3B82F6"], borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#8B9BB4", font: { size: 11 } } }, y: { ticks: { color: "#8B9BB4", font: { size: 10 } }, beginAtZero: true } } },
    }));

    return () => chartsRef.current.forEach(c => c.destroy());
  }, [loading, complaints]);

  const resolved = complaints.filter(c => c.status === "resolved").length;
  const sla = complaints.length ? Math.round(resolved / complaints.length * 100) : 0;

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20 }}>Analytics</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Complaints", value: String(complaints.length), color: "var(--text)" },
          { label: "Resolved", value: String(resolved), color: "var(--green)" },
          { label: "Resolution Rate", value: `${sla}%`, color: sla >= 70 ? "var(--green)" : "var(--amber)" },
          { label: "High Priority", value: String(complaints.filter(c => c.ai_priority === "High").length), color: "var(--red)" },
        ].map(s => (
          <div key={s.label} className="card-sm">
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-syne)", fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12 }}>Complaints — Last 14 Days</h3><div style={{ position: "relative", height: 200 }}><canvas ref={timeRef} /></div></div>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12 }}>By Category</h3><div style={{ position: "relative", height: 200 }}><canvas ref={catRef} /></div></div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12 }}>Priority Breakdown</h3>
        <div style={{ position: "relative", height: 160 }}><canvas ref={histRef} /></div>
      </div>
    </DashboardLayout>
  );
}
