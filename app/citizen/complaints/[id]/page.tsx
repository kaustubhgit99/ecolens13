"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { createClient } from "@/lib/supabase-browser";
import type { Complaint } from "@/lib/types";
import { CATEGORY_EMOJI } from "@/lib/types";

const STATUS_STEPS = ["pending", "routed", "in_progress", "resolved"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "Submitted",
  routed: "Assigned to Dept",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected_spam: "Rejected",
};

export default function ComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const complaintId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  useEffect(() => {
    if (!complaintId) return;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from("complaints").select("*").eq("id", complaintId).single();
      setComplaint(data as Complaint);
      setLoading(false);
    })();
  }, [complaintId]);

  const handleDelete = useCallback(async () => {
    if (!complaint) return;
    setDeleting(true);
    try {
      const sb = createClient();
      // Delete related records first (ignore errors from these)
      await sb.from("notifications").delete().eq("complaint_id", complaint.id);
      await sb.from("coin_transactions").delete().eq("complaint_id", complaint.id);
      // Delete the complaint
      const { error } = await sb.from("complaints").delete().eq("id", complaint.id);
      if (error) {
        alert("Failed to delete: " + error.message);
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      router.push("/citizen/complaints");
    } catch (err) {
      alert("Delete failed: " + (err instanceof Error ? err.message : "Unknown error"));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [complaint, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div className="spinner" />
        </div>
      </DashboardLayout>
    );
  }

  if (!complaint) {
    return (
      <DashboardLayout>
        <div className="card" style={{ textAlign: "center", color: "var(--text2)" }}>
          Complaint not found.
        </div>
      </DashboardLayout>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(
    complaint.status as (typeof STATUS_STEPS)[number]
  );

  return (
    <DashboardLayout>
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.7)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
            <h3 style={{ fontFamily: "var(--font-syne)", fontSize: 16, marginBottom: 8 }}>
              Delete Complaint?
            </h3>
            <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}>
              This action cannot be undone. The complaint and all related data will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: "#EF4444", color: "white", border: "none",
                }}
              >
                {deleting ? (
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  "Yes, Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href="/citizen/complaints">
          <button className="btn btn-ghost btn-sm">
            &larr; Back
          </button>
        </Link>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            background: "rgba(239,68,68,0.15)", color: "#EF4444",
            border: "1px solid rgba(239,68,68,0.3)", fontSize: 12,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>

      {/* Title bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>
            {complaint.id.slice(0, 8).toUpperCase()}
          </div>
          <h2 style={{ fontFamily: "var(--font-syne)", fontSize: 18 }}>
            {complaint.title}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.ai_priority} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            {complaint.image_url ? (
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border2)" }}>
                <img
                  src={complaint.image_url}
                  alt={complaint.title ?? "Complaint photo"}
                  style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block", cursor: "pointer" }}
                  onClick={() => window.open(complaint.image_url!, "_blank")}
                />
                <div style={{ background: "var(--surface2)", padding: "6px 12px", fontSize: 11, color: "var(--text3)" }}>
                  Photo evidence attached — click to enlarge
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 48, textAlign: "center", padding: "16px 0", background: "var(--surface2)", borderRadius: 8, marginBottom: 12 }}>
                {CATEGORY_EMOJI[complaint.ai_category ?? ""] ?? "?"}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>
              {complaint.address ?? complaint.ward}
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 12 }}>
              {complaint.ai_category} | Dept: {complaint.department}
            </div>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
              {complaint.description ?? "No description provided."}
            </p>
          </div>

          <div className="card" style={{ border: "1px solid var(--purple)", background: "#1A1030" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--purple)" }}>AI Analysis</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{complaint.ai_category ?? "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>Confidence</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                  {complaint.ai_confidence ? `${Math.round(complaint.ai_confidence * 100)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>Priority Score</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{complaint.ai_priority_score ?? "—"}/100</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>Severity</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{complaint.ai_severity ?? "—"}</div>
              </div>
            </div>
            {complaint.ai_is_spam && <div className="badge badge-red">Flagged as spam</div>}
            {complaint.ai_is_duplicate && <div className="badge badge-amber">Possible duplicate</div>}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontFamily: "var(--font-syne)", marginBottom: 16 }}>Status Timeline</h3>
            <div className="timeline">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} style={{ position: "relative", marginBottom: 18 }}>
                  <div className={`timeline-dot ${i < currentStepIdx ? "done" : i === currentStepIdx ? "active" : ""}`} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: i <= currentStepIdx ? "var(--text)" : "var(--text3)" }}>
                    {STATUS_LABELS[s]}
                  </div>
                  {i === 0 && (
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                      {new Date(complaint.created_at).toLocaleDateString("en-IN")}
                    </div>
                  )}
                  {s === "resolved" && complaint.resolved_at && (
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                      {new Date(complaint.resolved_at).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 13, fontFamily: "var(--font-syne)", marginBottom: 12 }}>Resolution Notes</h3>
            {complaint.resolution_notes ? (
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 13, color: "var(--text2)" }}>{complaint.resolution_notes}</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text2)" }}>
                No resolution notes yet. Check back after the issue is resolved.
              </p>
            )}
            {complaint.coins_awarded && (
              <div className="alert alert-green" style={{ marginTop: 12, marginBottom: 0 }}>
                +20 EcoCoins awarded on resolution!
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
