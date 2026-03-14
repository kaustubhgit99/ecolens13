"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import type { User, CoinTransaction } from "@/lib/types";

const EARNING_RULES=[["Submit a complaint","+10 🪙"],["Complaint resolved","+20 🪙"],["Complaint verified","+5 🪙"],["Weekly streak","+15 🪙"],["First report of new issue","+25 🪙"]];

export default function CoinsPage() {
  const [user, setUser] = useState<User|null>(null);
  const [txns, setTxns] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      const sb = createClient();
      const {data:{session}} = await sb.auth.getSession();
      if (!session) return;
      const [{data:u},{data:t}] = await Promise.all([
        sb.from("users").select("*").eq("id",session.user.id).single(),
        sb.from("coin_transactions").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}).limit(50),
      ]);
      setUser(u as User);
      setTxns((t??[]) as CoinTransaction[]);
      setLoading(false);
    })();
  },[]);

  if (loading) return <DashboardLayout><div style={{display:"flex",justifyContent:"center",padding:40}}><div className="spinner"/></div></DashboardLayout>;
  if (!user) return null;

  const tierProgress = user.coins_total>=301?100:user.coins_total>=101?Math.round((user.coins_total-101)/200*100):Math.round(user.coins_total/101*100);
  const tierLabel = user.coins_total>=301?"Gold 🥇":user.coins_total>=101?"Silver 🥈":"Bronze 🥉";
  const nextTier = user.coins_total>=301?null:user.coins_total>=101?`${301-user.coins_total} coins to Gold`:`${101-user.coins_total} coins to Silver`;

  return (
    <DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontFamily:"var(--font-syne)",fontSize:20,color:"var(--text)"}}>🪙 EcoWallet</h2>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16,marginBottom:16}}>
        <div className="card" style={{background:"linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",borderColor:"var(--primary3)"}}>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:8}}>Current Balance</div>
          <div style={{fontFamily:"var(--font-syne)",fontSize:48,fontWeight:700,color:"var(--gold)"}}>{user.coins_total}</div>
          <div style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>EcoCoins · {tierLabel}</div>
          <div style={{background:"rgba(255,255,255,.6)",borderRadius:12,padding:12,boxShadow:"var(--clay-inset)"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:8}}>
              <span style={{color:"var(--text2)"}}>🥉 Bronze</span>
              <span style={{color:user.coins_total>=101?"var(--gold)":"var(--text3)"}}>🥈 Silver</span>
              <span style={{color:user.coins_total>=301?"var(--gold)":"var(--text3)"}}>🥇 Gold</span>
            </div>
            <div className="progress" style={{marginBottom:6}}><div className="progress-fill" style={{width:`${tierProgress}%`}}/></div>
            {nextTier && <div style={{fontSize:11,color:"var(--text2)",textAlign:"center"}}>{nextTier}</div>}
          </div>
          <div style={{marginTop:12,fontSize:11,color:"var(--text2)"}}>This month: <span style={{color:"var(--gold)",fontWeight:700}}>{user.coins_month} coins</span></div>
        </div>

        <div className="card">
          <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:16,color:"var(--text)"}}>Earning Rules</h3>
          {EARNING_RULES.map(([ev,coins])=>(
            <div key={ev} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,color:"var(--text2)"}}>{ev}</span>
              <span style={{fontSize:13,color:"var(--gold)",fontWeight:700}}>{coins}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,color:"var(--text)"}}>Transaction History</h3>
          <span style={{fontSize:11,color:"var(--text2)"}}>{txns.length} transactions</span>
        </div>
        {txns.length===0?(
          <p style={{color:"var(--text2)",fontSize:13,textAlign:"center",padding:"16px 0"}}>No transactions yet. Submit a complaint to earn your first coins!</p>
        ):(
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table>
              <thead><tr><th>Date</th><th>Event</th><th>Amount</th></tr></thead>
              <tbody>
                {txns.map(t=>(
                  <tr key={t.id}>
                    <td style={{fontSize:11,color:"var(--text2)"}}>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                    <td style={{fontSize:12}}>{t.reason}</td>
                    <td><span style={{color:t.coins>0?"#16A34A":"var(--red)",fontWeight:700}}>{t.coins>0?"+":""}{t.coins}🪙</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{borderStyle:"dashed",textAlign:"center",padding:32,borderColor:"var(--border2)"}}>
        <div style={{fontSize:32,marginBottom:8}}>🎁</div>
        <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:4,color:"var(--text)"}}>Reward Redemption</h3>
        <p style={{color:"var(--text2)",fontSize:13,marginBottom:16}}>Exchange EcoCoins for AMC utility discounts and certificates.</p>
        <button className="btn btn-secondary" disabled>Coming Soon</button>
      </div>
    </DashboardLayout>
  );
}
