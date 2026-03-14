"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@/lib/types";

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [tab, setTab] = useState<"all_time"|"monthly">("all_time");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (session) setCurrentId(session.user.id);
      const orderCol = tab === "monthly" ? "coins_month" : "coins_total";
      const { data } = await sb.from("users").select("id,full_name,coins_total,coins_month,ward").eq("role","citizen").eq("is_blocked",false).order(orderCol,{ascending:false}).limit(20);
      setLeaders((data ?? []) as User[]);
      setLoading(false);
    })();
  }, [tab]);

  const COLORS = ["#0EA5E9","#3B82F6","#F59E0B","#16A34A","#EF4444","#14B8A6","#F97316","#EC4899"];
  const myRank = leaders.findIndex(u => u.id === currentId) + 1;

  return (
    <DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontFamily:"var(--font-syne)",fontSize:20,color:"var(--text)"}}>🏆 Amravati Leaderboard</h2>
        <div style={{display:"flex",gap:0,borderRadius:12,padding:4,background:"var(--surface2)",boxShadow:"var(--clay-inset)"}}>
          {[{k:"all_time",l:"All Time"},{k:"monthly",l:"This Month"}].map(({k,l})=>(
            <button key={k} onClick={()=>{setLoading(true);setTab(k as "all_time"|"monthly");}} style={{
              padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",
              background:tab===k?"linear-gradient(135deg, #0EA5E9, #0284C7)":"transparent",
              color:tab===k?"#FFFFFF":"var(--text3)",
              boxShadow:tab===k?"0 3px 10px rgba(14,165,233,0.25)":"none",
              transition:"all .2s",fontFamily:"inherit",
            }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      {!loading && leaders.length >= 3 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:12,marginBottom:24}}>
          {[leaders[1],leaders[0],leaders[2]].map((u,i)=>{
            const actualRank=[2,1,3][i];
            return (
              <div key={u.id} className="card" style={{textAlign:"center",border:actualRank===1?"2px solid var(--gold)":"1px solid rgba(255,255,255,0.6)"}}>
                <div style={{fontSize:28,marginBottom:8}}>{"🥈🥇🥉"[i]}</div>
                <div style={{width:46,height:46,borderRadius:"50%",background:COLORS[actualRank-1]+"18",color:COLORS[actualRank-1],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,margin:"0 auto 8px",boxShadow:"var(--clay-shadow-sm)"}}>
                  {u.full_name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
                </div>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4,color:"var(--text)"}}>{u.full_name}</div>
                <div style={{fontFamily:"var(--font-syne)",fontSize:18,fontWeight:700,color:"var(--gold)"}}>{tab==="monthly"?u.coins_month:u.coins_total}🪙</div>
                <div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>{u.ward ?? "Amravati"}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        {loading ? <div style={{display:"flex",justifyContent:"center",padding:40}}><div className="spinner"/></div> : (
          <>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table>
                <thead><tr><th>Rank</th><th>Citizen</th><th>Ward</th><th>{tab==="monthly"?"Month Coins":"Total Coins"}</th></tr></thead>
                <tbody>
                  {leaders.map((u,i)=>(
                    <tr key={u.id} style={{background:u.id===currentId?"var(--primarybg)":"transparent"}}>
                      <td style={{fontFamily:"var(--font-syne)",fontWeight:700,color:i===0?"var(--gold)":i===1?"#94A3B8":i===2?"#CD7C40":"var(--text3)"}}>
                        {i<3?["🥇","🥈","🥉"][i]:i+1}
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:COLORS[i%8]+"18",color:COLORS[i%8],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>
                            {u.full_name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
                          </div>
                          <span style={{color:"var(--text)"}}>{u.full_name}</span>{u.id===currentId&&<span className="badge badge-blue" style={{fontSize:9}}>You</span>}
                        </div>
                      </td>
                      <td style={{fontSize:12,color:"var(--text2)"}}>{u.ward ?? "—"}</td>
                      <td style={{color:"var(--gold)",fontWeight:700}}>{tab==="monthly"?u.coins_month:u.coins_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {myRank > 0 && myRank > 10 && (
              <div style={{background:"var(--primarybg)",border:"1px solid var(--primary3)",borderRadius:12,padding:12,marginTop:12,fontSize:13,color:"var(--primary)"}}>
                📍 Your rank: <strong>#{myRank}</strong>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
