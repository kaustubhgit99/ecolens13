"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/shared/Badges";
import { createClient } from "@/lib/supabase-browser";
import type { User, Complaint } from "@/lib/types";
import { CATEGORY_EMOJI } from "@/lib/types";

export default function CitizenDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const [{ data: u }, { data: c }, { data: lb }] = await Promise.all([
        sb.from("users").select("*").eq("id", session.user.id).single(),
        sb.from("complaints").select("*").eq("citizen_id", session.user.id).order("created_at", { ascending: false }).limit(3),
        sb.from("users").select("id,full_name,coins_total,coins_month,ward").eq("role","citizen").eq("is_blocked",false).order("coins_total",{ascending:false}).limit(7),
      ]);
      setUser(u as User);
      setComplaints((c ?? []) as Complaint[]);
      setLeaderboard((lb ?? []) as User[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardLayout><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}><div className="spinner"/></div></DashboardLayout>;
  if (!user) return null;

  const total = complaints.length;
  const resolved = complaints.filter(c => c.status === "resolved").length;
  const inProgress = complaints.filter(c => c.status === "in_progress" || c.status === "routed").length;
  const myRank = leaderboard.findIndex(u2 => u2.id === user.id) + 1;

  return (
    <DashboardLayout>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"var(--font-syne)",fontSize:22,marginBottom:4,color:"var(--text)"}}>Welcome back, {user.full_name.split(" ")[0]} 👋</h2>
          <p style={{color:"var(--text2)",fontSize:13}}>Ward: {user.ward ?? "Amravati"} · AMC Civic Portal</p>
        </div>
        <Link href="/citizen/report"><button className="btn btn-primary">+ Report Issue</button></Link>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Reports",value:String(total),sub:"All time",color:"var(--primary)"},
          {label:"Resolved",value:String(resolved),sub:`${total?Math.round(resolved/total*100):0}% rate`,color:"#16A34A"},
          {label:"In Progress",value:String(inProgress),sub:"Being worked on",color:"var(--blue)"},
          {label:"EcoCoins",value:String(user.coins_total),sub:user.coins_total>=301?"🥇 Gold":user.coins_total>=101?"🥈 Silver":"🥉 Bronze",color:"var(--gold)"},
        ].map(s=>(
          <div key={s.label} className="card-sm">
            <div style={{fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{s.label}</div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:26,fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16,marginBottom:16}}>
        {/* Recent complaints */}
        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,color:"var(--text)"}}>Recent Complaints</h3>
            <Link href="/citizen/complaints"><button className="btn btn-ghost btn-sm">View all →</button></Link>
          </div>
          {complaints.length === 0 ? (
            <div style={{textAlign:"center",padding:"24px 0",color:"var(--text2)"}}>
              <div style={{fontSize:32,marginBottom:8}}>📋</div>
              <p style={{fontSize:13}}>No complaints yet.</p>
              <Link href="/citizen/report"><button className="btn btn-primary btn-sm" style={{marginTop:12}}>Report your first issue</button></Link>
            </div>
          ) : complaints.slice(0,3).map(c=>(
            <Link key={c.id} href={`/citizen/complaints/${c.id}`} style={{textDecoration:"none"}}>
              <div style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
                <div style={{width:44,height:44,borderRadius:12,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:"var(--clay-shadow-sm)"}}>
                  {CATEGORY_EMOJI[c.ai_category ?? ""] ?? "❓"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"var(--font-syne)",fontSize:13,fontWeight:600,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"var(--text)"}}>{c.title}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <StatusBadge status={c.status}/>
                    <span style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--font-jetbrains)"}}>{c.ward}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Coins + mini leaderboard */}
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,color:"var(--text)"}}>🪙 EcoCoin Balance</h3>
              <Link href="/citizen/coins"><button className="btn btn-ghost btn-sm">Wallet →</button></Link>
            </div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:32,fontWeight:700,color:"var(--gold)",marginBottom:6}}>{user.coins_total}</div>
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:8}}>
              {user.coins_total>=301?"Gold Tier 🥇":user.coins_total>=101?"Silver Tier 🥈":"Bronze Tier 🥉"} · {user.coins_total>=301?"":`${user.coins_total>=101?301-user.coins_total:101-user.coins_total} to ${user.coins_total>=101?"Gold":"Silver"}`}
            </div>
            <div className="progress" style={{marginBottom:6}}><div className="progress-fill" style={{width:`${Math.min(user.coins_total>=101?((user.coins_total-101)/200*100):user.coins_total,100)}%`}}/></div>
          </div>
          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,color:"var(--text)"}}>🏆 Leaderboard</h3>
              <Link href="/citizen/leaderboard"><button className="btn btn-ghost btn-sm">Full →</button></Link>
            </div>
            {leaderboard.slice(0,5).map((u2,i)=>(
              <div key={u2.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:11,width:18,textAlign:"center",color:"var(--text3)"}}>{i+1}</span>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#E0F2FE",color:"#0EA5E9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>
                  {u2.full_name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
                </div>
                <span style={{fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)"}}>{u2.full_name}{u2.id===user.id?" (you)":""}</span>
                <span style={{fontSize:11,color:"var(--gold)",fontWeight:700}}>{u2.coins_total}🪙</span>
              </div>
            ))}
            {myRank > 5 && (
              <div style={{background:"var(--primarybg)",borderRadius:10,padding:"8px 10px",marginTop:8,fontSize:12,color:"var(--primary)",border:"1px solid var(--primary3)"}}>
                📍 Your rank: #{myRank}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* City snapshot */}
      <div className="card">
        <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:16,color:"var(--text)"}}>🏙️ Amravati City Snapshot</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:16}}>
          <div>
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:4}}>Your Ward</div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:16,fontWeight:700,color:"var(--text)"}}>{user.ward ?? "N/A"}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:4}}>This Month Coins</div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:16,fontWeight:700,color:"var(--gold)"}}>{user.coins_month}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:4}}>AMC Helpline</div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:16,fontWeight:700,color:"var(--text)"}}>0721-2662222</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
