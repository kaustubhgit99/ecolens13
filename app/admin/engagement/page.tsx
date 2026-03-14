"use client";
import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { User, CoinTransaction } from "@/lib/types";
import { Chart, BarController, LineController, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from "chart.js";
Chart.register(BarController,LineController,BarElement,LineElement,PointElement,CategoryScale,LinearScale,Filler,Tooltip,Legend);

export default function EngagementPage() {
  const regRef = useRef<HTMLCanvasElement>(null);
  const coinRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);
  const [citizens, setCitizens] = useState<User[]>([]);
  const [txns, setTxns] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [{ data: u }, { data: t }] = await Promise.all([
        sb.from("users").select("id,full_name,coins_total,coins_month,ward,created_at").eq("role","citizen").eq("is_blocked",false).order("coins_total",{ascending:false}),
        sb.from("coin_transactions").select("coins,created_at"),
      ]);
      setCitizens((u ?? []) as User[]);
      setTxns((t ?? []) as CoinTransaction[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    chartsRef.current.forEach(c => c.destroy()); chartsRef.current = [];

    // Registrations per month (last 6)
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return d; });
    const regData = months.map(m => citizens.filter(u => { const cd = new Date(u.created_at); return cd.getMonth() === m.getMonth() && cd.getFullYear() === m.getFullYear(); }).length);
    if (regRef.current) chartsRef.current.push(new Chart(regRef.current, {
      type: "line",
      data: { labels: months.map(d => d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"})), datasets: [{ data: regData, borderColor: "#8B5CF6", backgroundColor: "rgba(139,92,246,.1)", tension: .4, fill: true, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#8B9BB4", font: { size: 10 } } }, y: { ticks: { color: "#8B9BB4", font: { size: 10 } }, beginAtZero: true } } },
    }));

    // Coins earned per month
    const coinsData = months.map(m => txns.filter(t => { const cd = new Date(t.created_at); return t.coins > 0 && cd.getMonth() === m.getMonth() && cd.getFullYear() === m.getFullYear(); }).reduce((a, b) => a + b.coins, 0));
    if (coinRef.current) chartsRef.current.push(new Chart(coinRef.current, {
      type: "bar",
      data: { labels: months.map(d => d.toLocaleDateString("en-IN",{month:"short"})), datasets: [{ data: coinsData, backgroundColor: "rgba(245,158,11,.6)", borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#8B9BB4", font: { size: 10 } } }, y: { ticks: { color: "#8B9BB4", font: { size: 10 } }, beginAtZero: true } } },
    }));

    return () => chartsRef.current.forEach(c => c.destroy());
  }, [loading, citizens, txns]);

  const totalCoins = txns.filter(t => t.coins > 0).reduce((a, b) => a + b.coins, 0);
  const bronze = citizens.filter(u => u.coins_total < 101).length;
  const silver = citizens.filter(u => u.coins_total >= 101 && u.coins_total < 301).length;
  const gold   = citizens.filter(u => u.coins_total >= 301).length;

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20 }}>Citizen Engagement</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Citizens",   value: String(citizens.length),   color: "var(--text)" },
          { label: "Active (>0 coins)",value: String(citizens.filter(u=>u.coins_total>0).length), color: "var(--green)" },
          { label: "Coins Issued",     value: String(totalCoins),         color: "var(--gold)" },
          { label: "Gold Tier",        value: String(gold),               color: "var(--gold)" },
        ].map(s => (
          <div key={s.label} className="card-sm">
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-syne)", fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12 }}>New Registrations / Month</h3><div style={{ position: "relative", height: 200 }}><canvas ref={regRef} /></div></div>
        <div className="card"><h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 12 }}>EcoCoins Issued / Month</h3><div style={{ position: "relative", height: 200 }}><canvas ref={coinRef} /></div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 16 }}>Top Contributing Citizens</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Rank</th><th>Name</th><th>Ward</th><th>Total Coins</th><th>Month Coins</th></tr></thead>
            <tbody>
              {citizens.slice(0, 10).map((u, i) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "var(--font-syne)", fontWeight: 700, color: i === 0 ? "var(--gold)" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7C40" : "var(--text3)" }}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </td>
                  <td>{u.full_name}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{u.ward}</td>
                  <td style={{ color: "var(--gold)", fontWeight: 700 }}>{u.coins_total}</td>
                  <td style={{ color: "var(--text2)" }}>{u.coins_month}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 13, marginBottom: 16 }}>Tier Distribution</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Bronze", count: bronze, color: "#CD7C40", pct: citizens.length ? Math.round(bronze/citizens.length*100) : 0 },
            { label: "Silver", count: silver, color: "#94A3B8", pct: citizens.length ? Math.round(silver/citizens.length*100) : 0 },
            { label: "Gold",   count: gold,   color: "var(--gold)", pct: citizens.length ? Math.round(gold/citizens.length*100) : 0 },
          ].map(t => (
            <div key={t.label} style={{ background: "var(--surface2)", borderRadius: 14, padding: "16px 20px", border: "1px solid var(--border2)" }}>
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{t.label} Tier</div>
              <div style={{ fontFamily: "var(--font-syne)", fontSize: 20, fontWeight: 700, color: t.color }}>{t.count} citizens</div>
              <div className="progress" style={{ marginTop: 10 }}><div className="progress-fill" style={{ width: `${t.pct}%`, background: t.color }} /></div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{t.pct}% of total</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
