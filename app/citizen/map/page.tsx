"use client";
import dynamic from "next/dynamic";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ComplaintHeatmap = dynamic(
  () => import("@/components/shared/ComplaintHeatmap"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: "calc(100vh - 104px)", borderRadius: 14,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Initializing map...</div>
        </div>
      </div>
    ),
  }
);

export default function CitizenMapPage() {
  return (
    <DashboardLayout>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 20, marginBottom: 4, color: "var(--text)" }}>
          🗺️ Complaint Thermomap
        </h2>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>
          Real-time civic complaint heatmap of Amravati — synced live with all reports
        </p>
      </div>
      <ComplaintHeatmap />
    </DashboardLayout>
  );
}
