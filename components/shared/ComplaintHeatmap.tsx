"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import "leaflet.heat";
import { createClient } from "@/lib/supabase-browser";

// ── Types ─────────────────────────────────────────────────────────
interface ComplaintPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  ward: string | null;
  ai_priority: string | null;
  status: string;
}

// ── Priority → heat intensity mapping ─────────────────────────────
const PRIORITY_INTENSITY: Record<string, number> = {
  Critical: 1.0,
  High: 0.8,
  Moderate: 0.6,
  Medium: 0.4,
  Low: 0.2,
};

const PRIORITY_COLOR: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F97316",
  Moderate: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#22C55E",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  routed: "Routed",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

// ── Marker icon builder ───────────────────────────────────────────
function createMarkerIcon(priority: string): L.DivIcon {
  const color = PRIORITY_COLOR[priority] || "#8B9BB4";
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `
      <div style="
        width:28px; height:28px; display:flex; align-items:center; justify-content:center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
          <circle cx="12" cy="9" r="3" fill="#fff" opacity="0.9"/>
        </svg>
      </div>
    `,
  });
}

// ── Component ─────────────────────────────────────────────────────
export default function ComplaintHeatmap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const heatLayer = useRef<L.Layer | null>(null);
  const markerGroup = useRef<L.LayerGroup | null>(null);
  const [complaints, setComplaints] = useState<ComplaintPoint[]>([]);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch complaints ────────────────────────────────────────────
  const fetchComplaints = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("complaints")
      .select("id, latitude, longitude, title, ward, ai_priority, status")
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    if (data) {
      setComplaints(data as ComplaintPoint[]);
    }
    setIsLoading(false);
  }, []);

  // ── Initialize map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [20.9374, 77.7796],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Light-themed tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // Zoom control on top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Attribution bottom-right
    L.control
      .attribution({ position: "bottomright" })
      .addAttribution(
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      )
      .addTo(map);

    // Initialize layer group for markers
    markerGroup.current = L.layerGroup().addTo(map);

    leafletMap.current = map;

    // Fetch data
    fetchComplaints();

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [fetchComplaints]);

  // ── Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("complaints-heatmap")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => {
          fetchComplaints();
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchComplaints]);

  // ── Update heatmap + markers when data or filters change ────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Filter
    const filtered =
      filterPriority === "all"
        ? complaints
        : complaints.filter((c) => c.ai_priority === filterPriority);

    // ── Heatmap layer ──────────────────────────────────────────
    if (heatLayer.current) {
      map.removeLayer(heatLayer.current);
      heatLayer.current = null;
    }

    if (showHeatmap && filtered.length > 0) {
      const heatData: [number, number, number][] = filtered.map((c) => [
        c.latitude,
        c.longitude,
        PRIORITY_INTENSITY[c.ai_priority || "Medium"] || 0.4,
      ]);

      // @ts-expect-error - L.heatLayer comes from leaflet.heat plugin
      heatLayer.current = L.heatLayer(heatData, {
        radius: 35,
        blur: 25,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.0: "#BAE6FD",
          0.2: "#7DD3FC",
          0.4: "#38BDF8",
          0.5: "#22D3EE",
          0.6: "#22C55E",
          0.7: "#F59E0B",
          0.85: "#F97316",
          1.0: "#EF4444",
        },
      }).addTo(map);
    }

    // ── Markers ───────────────────────────────────────────────
    if (markerGroup.current) {
      markerGroup.current.clearLayers();
    }

    if (showMarkers) {
      filtered.forEach((c) => {
        const priority = c.ai_priority || "Medium";
        const icon = createMarkerIcon(priority);
        const statusText = STATUS_LABEL[c.status] || c.status;
        const priorityColor = PRIORITY_COLOR[priority] || "#8B9BB4";

        const popup = L.popup({
          className: "ecolens-popup",
          maxWidth: 280,
          closeButton: true,
        }).setContent(`
          <div style="
            background: #FFFFFF;
            border: 1px solid #D0E5F5;
            border-radius: 14px;
            padding: 14px 16px;
            font-family: 'DM Sans', sans-serif;
            color: #1E293B;
            min-width: 220px;
            box-shadow: 4px 4px 12px rgba(163,199,224,0.3);
          ">
            <div style="font-size:13px; font-weight:600; margin-bottom:10px; line-height:1.4;">
              ${c.title || "Untitled Complaint"}
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
              <span style="
                display:inline-flex; align-items:center; gap:4px;
                padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600;
                background:${priorityColor}18; color:${priorityColor}; border:1px solid ${priorityColor}33;
              ">● ${priority}</span>
              <span style="
                display:inline-flex; align-items:center; gap:4px;
                padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600;
                background:#F1F5F9; color:#64748B; border:1px solid #E2E8F0;
              ">${statusText}</span>
            </div>
            ${c.ward ? `
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748B;">
                <span>📍</span>
                <span>${c.ward}</span>
              </div>
            ` : ""}
            <div style="
              margin-top:10px; padding-top:8px; border-top:1px solid #E2E8F0;
              font-size:10px; color:#94A3B8; font-family:monospace;
            ">
              ID: ${c.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        `);

        const marker = L.marker([c.latitude, c.longitude], { icon }).bindPopup(popup);
        markerGroup.current?.addLayer(marker);
      });
    }
  }, [complaints, showMarkers, showHeatmap, filterPriority]);

  // ── Compute stats ───────────────────────────────────────────────
  const stats = {
    total: complaints.length,
    critical: complaints.filter((c) => c.ai_priority === "Critical").length,
    high: complaints.filter((c) => c.ai_priority === "High").length,
    moderate: complaints.filter((c) => c.ai_priority === "Moderate").length,
    medium: complaints.filter((c) => c.ai_priority === "Medium").length,
    low: complaints.filter((c) => c.ai_priority === "Low").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    active: complaints.filter((c) => c.status !== "resolved" && c.status !== "rejected").length,
  };

  return (
    <div style={{ position: "relative", height: "calc(100vh - 104px)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
      {/* Map container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%", background: "var(--surface2)" }} />

      {/* ── Top-left: Title + Stats panel ────────────────────────── */}
      <div style={{
        position: "absolute", top: 14, left: 14, zIndex: 1000,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px",
        maxWidth: 280, width: "100%",
        boxShadow: "4px 4px 16px rgba(163,199,224,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#0EA5E9,#0284C7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            boxShadow: "0 3px 10px rgba(14,165,233,0.25)",
          }}>🗺️</div>
          <div>
            <div style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: 14 }}>
              Complaint <span style={{ color: "var(--green)" }}>Thermomap</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)" }}>Amravati, Maharashtra</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{stats.total}</div>
            <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>{stats.resolved}</div>
            <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Resolved</div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--red)" }}>{stats.critical + stats.high}</div>
            <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Urgent</div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--blue)" }}>{stats.active}</div>
            <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Active</div>
          </div>
        </div>

        {/* Layer toggles */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid",
              borderColor: showHeatmap ? "var(--green)" : "var(--border2)",
              background: showHeatmap ? "var(--greenbg)" : "var(--surface2)",
              color: showHeatmap ? "var(--green)" : "var(--text3)",
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s",
            }}
          >
            🔥 Heatmap
          </button>
          <button
            onClick={() => setShowMarkers((v) => !v)}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid",
              borderColor: showMarkers ? "var(--green)" : "var(--border2)",
              background: showMarkers ? "var(--greenbg)" : "var(--surface2)",
              color: showMarkers ? "var(--green)" : "var(--text3)",
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s",
            }}
          >
            📍 Markers
          </button>
        </div>

        {/* Priority filter */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
          Filter by Priority
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            { key: "all", label: "All", color: "#8B9BB4" },
            { key: "Critical", label: "Critical", color: "#EF4444" },
            { key: "High", label: "High", color: "#F97316" },
            { key: "Moderate", label: "Moderate", color: "#F59E0B" },
            { key: "Medium", label: "Medium", color: "#3B82F6" },
            { key: "Low", label: "Low", color: "#22C55E" },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilterPriority(key)}
              style={{
                padding: "3px 10px", borderRadius: 20, border: "1px solid",
                borderColor: filterPriority === key ? color : "var(--border2)",
                background: filterPriority === key ? `${color}18` : "transparent",
                color: filterPriority === key ? color : "var(--text3)",
                fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all .15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom-right: Heatmap legend ─────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 30, right: 14, zIndex: 1000,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px",
        boxShadow: "4px 4px 12px rgba(163,199,224,0.3)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>
          Heat Intensity
        </div>
        <div style={{
          width: 160, height: 10, borderRadius: 5, marginBottom: 6,
          background: "linear-gradient(90deg, #BAE6FD, #38BDF8, #22D3EE, #22C55E, #F59E0B, #F97316, #EF4444)",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text3)" }}>
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Critical</span>
        </div>
      </div>

      {/* ── Bottom-left: Live indicator ──────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 30, left: 14, zIndex: 1000,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        border: "1px solid var(--border)", borderRadius: 20, padding: "5px 12px",
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: "4px 4px 12px rgba(163,199,224,0.3)",
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#16A34A",
          boxShadow: "0 0 6px #16A34A",
          animation: "pulse 2s infinite",
        }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#16A34A" }}>
          LIVE SYNCED
        </span>
      </div>

      {/* ── Loading overlay ──────────────────────────────────────── */}
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1100,
          background: "rgba(232,244,253,0.9)", backdropFilter: "blur(8px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Loading complaint data...</div>
        </div>
      )}

      {/* ── Custom Leaflet popup styles ───────────────────────────── */}
      <style>{`
        .ecolens-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 14px !important;
        }
        .ecolens-popup .leaflet-popup-content {
          margin: 0 !important;
          line-height: 1.4 !important;
        }
        .ecolens-popup .leaflet-popup-tip {
          background: #FFFFFF !important;
          border: 1px solid #D0E5F5 !important;
          box-shadow: none !important;
        }
        .ecolens-popup .leaflet-popup-close-button {
          color: #94A3B8 !important;
          font-size: 18px !important;
          top: 8px !important;
          right: 10px !important;
        }
        .ecolens-popup .leaflet-popup-close-button:hover {
          color: #1E293B !important;
        }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.92) !important;
          color: #1E293B !important;
          border-color: #D0E5F5 !important;
          backdrop-filter: blur(8px);
          box-shadow: 2px 2px 6px rgba(163,199,224,0.2);
        }
        .leaflet-control-zoom a:hover {
          background: #E0F2FE !important;
          color: #0EA5E9 !important;
        }
        .leaflet-control-attribution {
          background: rgba(255,255,255,0.8) !important;
          color: #94A3B8 !important;
          font-size: 9px !important;
          backdrop-filter: blur(4px);
        }
        .leaflet-control-attribution a {
          color: #0EA5E9 !important;
        }
      `}</style>
    </div>
  );
}
