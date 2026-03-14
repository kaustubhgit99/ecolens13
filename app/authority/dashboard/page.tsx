"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint } from "@/lib/types";
import { Chart, DoughnutController, LineController, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from "chart.js";
Chart.register(DoughnutController,LineController,ArcElement,LineElement,PointElement,CategoryScale,LinearScale,Filler,Tooltip,Legend);

export default function AuthDashboard() {
  const donutRef = useRef<HTMLCanvasElement>(null);
  const lineRef  = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      const sb = createClient();
      const {data} = await sb.from("complaints").select("*,citizen:citizen_id(full_name,ward)").order("created_at",{ascending:false}).limit(100);
      setComplaints((data??[]) as Complaint[]);
      setLoading(false);
    })();
  },[]);

  useEffect(()=>{
    if (loading||!donutRef.current||!lineRef.current) return;
    chartsRef.current.forEach(c=>c.destroy()); chartsRef.current=[];

    const high=complaints.filter(c=>c.ai_priority==="High").length;
    const med=complaints.filter(c=>c.ai_priority==="Medium").length;
    const low=complaints.filter(c=>c.ai_priority==="Low").length;
    chartsRef.current.push(new Chart(donutRef.current,{type:"doughnut",data:{labels:["High","Medium","Low"],datasets:[{data:[high,med,low],backgroundColor:["#EF4444","#F59E0B","#3B82F6"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:"#64748B",font:{size:11},padding:12}}}}}));

    // Last 7 days resolved
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d;});
    const resolved=days.map(d=>complaints.filter(c=>c.status==="resolved"&&new Date(c.resolved_at??c.updated_at).toDateString()===d.toDateString()).length);
    chartsRef.current.push(new Chart(lineRef.current,{type:"line",data:{labels:days.map(d=>d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})),datasets:[{label:"Resolved",data:resolved,borderColor:"#0EA5E9",backgroundColor:"rgba(14,165,233,.1)",tension:.4,fill:true,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#94A3B8",font:{size:10}},grid:{color:"rgba(208,229,245,0.5)"}},y:{ticks:{color:"#94A3B8",font:{size:10}},beginAtZero:true,grid:{color:"rgba(208,229,245,0.5)"}}}}}));

    return ()=>chartsRef.current.forEach(c=>c.destroy());
  },[loading,complaints]);

  const urgent = complaints.filter(c=>c.ai_priority==="High"&&c.status!=="resolved").slice(0,5);
  const resolved = complaints.filter(c=>c.status==="resolved").length;
  const inProg = complaints.filter(c=>c.status==="in_progress"||c.status==="routed").length;

  return (
    <DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"var(--font-syne)",fontSize:22,marginBottom:4,color:"var(--text)"}}>Authority Dashboard</h2>
          <p style={{color:"var(--text2)",fontSize:13}}>Amravati Municipal Corporation · {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <Link href="/authority/queue"><button className="btn btn-primary">View Queue</button></Link>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Assigned",value:String(complaints.length),sub:"All complaints",color:"var(--text)"},
          {label:"Resolved",value:String(resolved),sub:`${complaints.length?Math.round(resolved/complaints.length*100):0}% rate`,color:"#16A34A"},
          {label:"In Progress",value:String(inProg),sub:"Being actioned",color:"var(--blue)"},
          {label:"High Priority",value:String(complaints.filter(c=>c.ai_priority==="High"&&c.status!=="resolved").length),sub:"Needs attention",color:"var(--red)"},
        ].map(s=>(
          <div key={s.label} className="card-sm">
            <div style={{fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{s.label}</div>
            <div style={{fontFamily:"var(--font-syne)",fontSize:26,fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16,marginBottom:16}}>
        <div className="card"><h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:12,color:"var(--text)"}}>Priority Distribution</h3><div style={{position:"relative",height:200}}><canvas ref={donutRef}/></div></div>
        <div className="card"><h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:12,color:"var(--text)"}}>Resolved Last 7 Days</h3><div style={{position:"relative",height:200}}><canvas ref={lineRef}/></div></div>
      </div>

      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,color:"var(--text)"}}>🔴 Urgent — High Priority Open</h3>
          <Link href="/authority/queue"><button className="btn btn-ghost btn-sm">Full Queue →</button></Link>
        </div>
        {urgent.length===0?<p style={{color:"var(--text2)",fontSize:13}}>No urgent complaints. 🎉</p>:(
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table>
              <thead><tr><th>ID</th><th>Title</th><th>Ward</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {urgent.map(c=>(
                  <tr key={c.id}>
                    <td style={{fontFamily:"var(--font-jetbrains)",fontSize:11}}>{c.id.slice(0,8).toUpperCase()}</td>
                    <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13}}>{c.title}</td>
                    <td style={{fontSize:12,color:"var(--text2)"}}>{c.ward}</td>
                    <td><PriorityBadge priority={c.ai_priority}/></td>
                    <td><StatusBadge status={c.status}/></td>
                    <td><Link href={`/citizen/complaints/${c.id}`}><button className="btn btn-secondary btn-sm">View</button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
