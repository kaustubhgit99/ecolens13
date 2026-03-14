"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase-browser";
import { CATEGORIES } from "@/lib/types";

const AMRAVATI_WARDS = [
  "Ward 1 - Rajapeth","Ward 2 - Jaistambh Chowk","Ward 3 - Wadali","Ward 4 - Cidco",
  "Ward 5 - Garoba Maidan","Ward 6 - Panchsheel Nagar","Ward 7 - Shivnagar",
  "Ward 8 - Laxmi Nagar","Ward 9 - Venkatesh Nagar","Ward 10 - Jawahar Gate",
  "Ward 11 - Gandhi Gate","Ward 12 - Prabhat Square","Ward 13 - Camp Area",
  "Ward 14 - Tapadia Nagar","Ward 15 - Badnera",
];

const DEPT_MAP: Record<string,string> = {
  "Road Damage":"PWD","Garbage":"SAN","Sewage":"DRN","Lighting":"ELC",
  "Water Supply":"WTR","Air Quality":"GEN","Noise":"GEN","Other":"GEN",
};

const WARD_COORDS: Record<string,[number,number]> = {
  "Ward 1 - Rajapeth":[20.9320,77.7523],"Ward 2 - Jaistambh Chowk":[20.9329,77.7560],
  "Ward 3 - Wadali":[20.9260,77.7610],"Ward 4 - Cidco":[20.9400,77.7480],
  "Ward 5 - Garoba Maidan":[20.9350,77.7600],"Ward 6 - Panchsheel Nagar":[20.9280,77.7450],
  "Ward 7 - Shivnagar":[20.9410,77.7550],"Ward 8 - Laxmi Nagar":[20.9370,77.7490],
  "Ward 9 - Venkatesh Nagar":[20.9300,77.7580],"Ward 10 - Jawahar Gate":[20.9340,77.7540],
  "Ward 11 - Gandhi Gate":[20.9290,77.7510],"Ward 12 - Prabhat Square":[20.9360,77.7570],
  "Ward 13 - Camp Area":[20.9315,77.7495],"Ward 14 - Tapadia Nagar":[20.9380,77.7440],
  "Ward 15 - Badnera":[20.9180,77.7700],
};

type ReportMode = "manual" | "voice";

export default function ReportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<ReportMode>("manual");
  const [step, setStep] = useState(1);
  const [cat, setCat] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [ward, setWard] = useState("");
  const [address, setAddress] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refId, setRefId] = useState("");
  const [watermarking, setWatermarking] = useState(false);
  const [photoGps, setPhotoGps] = useState<{lat:number;lng:number}|null>(null);
  const [gpsCoords, setGpsCoords] = useState<{lat:number;lng:number}|null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle"|"fetching"|"done"|"error">("idle");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiPriority, setAiPriority] = useState("Medium");
  const [aiPriorityScore, setAiPriorityScore] = useState(50);
  const [detectedLang, setDetectedLang] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Capture GPS coordinates when Step 2 is reached
  useEffect(() => {
    if (step === 2 && !gpsCoords && gpsStatus === "idle") {
      setGpsStatus("fetching");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsStatus("done");
          },
          () => setGpsStatus("error"),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setGpsStatus("error");
      }
    }
  }, [step, gpsCoords, gpsStatus]);

  // ── Get GPS coordinates ─────────────────────────────────────
  const getGpsCoords = (): Promise<{lat:number;lng:number}> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 20.9374, lng: 77.7796 }); // Amravati fallback
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 20.9374, lng: 77.7796 }), // fallback on error
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  // ── Watermark image with timestamp + GPS ────────────────────
  const watermarkImage = (file: File, gps: {lat:number;lng:number}): Promise<{stampedFile: File; previewUrl: string}> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Build watermark text
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
        const lines = [
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          `Lat: ${gps.lat.toFixed(4)}`,
          `Lng: ${gps.lng.toFixed(4)}`,
        ];

        // Scale font size relative to image dimensions
        const fontSize = Math.max(14, Math.round(Math.min(img.width, img.height) * 0.028));
        const lineHeight = fontSize * 1.35;
        const padding = fontSize * 0.8;
        const blockHeight = lines.length * lineHeight + padding * 2;
        const blockWidth = fontSize * 12 + padding * 2;

        // Draw semi-transparent background in bottom-left
        const bx = padding;
        const by = img.height - blockHeight - padding;
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.beginPath();
        ctx.roundRect(bx, by, blockWidth, blockHeight, fontSize * 0.4);
        ctx.fill();

        // Draw text
        ctx.font = `bold ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
        ctx.fillStyle = "#22C55E";
        ctx.textBaseline = "top";
        lines.forEach((line, i) => {
          ctx.fillText(line, bx + padding, by + padding + i * lineHeight);
        });

        // Draw EcoLens badge
        ctx.font = `bold ${Math.round(fontSize * 0.7)}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("📍 EcoLens Verified", bx + padding, by + blockHeight - padding * 0.5);

        // Export as file
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Canvas export failed")); return; }
          const stampedFile = new File([blob], `stamped_${Date.now()}.jpg`, { type: "image/jpeg" });
          const previewUrl = URL.createObjectURL(blob);
          resolve({ stampedFile, previewUrl });
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  // ── Handle photo selection (camera or gallery) ──────────────
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    setError("");
    setWatermarking(true);

    try {
      // Get GPS coordinates
      const gps = await getGpsCoords();
      setPhotoGps(gps);

      // Apply watermark
      const { stampedFile, previewUrl } = await watermarkImage(file, gps);
      setPhoto(stampedFile);
      setPhotoPreview(previewUrl);
    } catch (err) {
      console.warn("Watermark failed, using original:", err);
      // Fallback: use the original file without watermark
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    } finally {
      setWatermarking(false);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoGps(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  // ── Voice Recording ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Try supported MIME types in order of preference
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
      let selectedMime = "";
      for (const mime of mimeTypes) {
        if (!mime || MediaRecorder.isTypeSupported(mime)) { selectedMime = mime; break; }
      }
      const recorderOptions = selectedMime ? { mimeType: selectedMime } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      console.log("[voice] Using MIME type:", selectedMime || "browser default");
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeForBlob = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeForBlob });
        console.log("[voice] Recording stopped, blob size:", blob.size, "mime:", mimeForBlob);
        if (blob.size < 1000) {
          setError("Recording too short. Please speak for at least 2 seconds.");
          return;
        }
        await processRecording(blob);
      };

      recorder.start(250); // Capture data every 250ms to avoid empty recordings
      mediaRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setError("");
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error("[voice] Microphone error:", err);
      setError("Microphone access denied. Please allow microphone permission and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state === "recording") {
      mediaRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const processRecording = async (blob: Blob) => {
    // Step 1: Transcribe
    setTranscribing(true);
    setError("");
    try {
      // Determine file extension from MIME type
      const mimeToExt: Record<string, string> = {
        "audio/webm": "webm", "audio/webm;codecs=opus": "webm",
        "audio/ogg": "ogg", "audio/ogg;codecs=opus": "ogg",
        "audio/mp4": "mp4", "audio/mpeg": "mp3",
      };
      const ext = mimeToExt[blob.type] || "webm";
      const fileName = `recording.${ext}`;

      const formData = new FormData();
      formData.append("audio", blob, fileName);

      console.log("[voice] Sending to /api/transcribe, file:", fileName, "size:", blob.size);
      const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: formData });
      const transcribeData = await transcribeRes.json();

      if (transcribeData.error) {
        setError(`Transcription failed: ${transcribeData.error}`);
        setTranscribing(false);
        return;
      }

      setTranscript(transcribeData.transcript);
      setDetectedLang(transcribeData.language || "");
      setTranscribing(false);

      // Step 2: Analyze with AI
      setAnalyzing(true);
      const analyzeRes = await fetch("/api/analyze-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcribeData.transcript, language: transcribeData.language }),
      });
      const analysis = await analyzeRes.json();

      if (!analysis.error) {
        // Auto-fill form fields
        if (analysis.title) setTitle(analysis.title);
        if (analysis.description) setDesc(analysis.description);
        if (analysis.category && CATEGORIES.some((c: { label: string }) => c.label === analysis.category)) {
          setCat(analysis.category);
        }
        if (analysis.ward && AMRAVATI_WARDS.includes(analysis.ward)) {
          setWard(analysis.ward);
        }
        if (analysis.address) setAddress(analysis.address);
        if (analysis.priority) setAiPriority(analysis.priority);
        if (analysis.priority_score) setAiPriorityScore(Number(analysis.priority_score));
      }
      setAnalyzing(false);
    } catch (err) {
      console.error("Voice processing error:", err);
      setError("Failed to process voice recording. Please try again.");
      setTranscribing(false);
      setAnalyzing(false);
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── Submit ───────────────────────────────────────────────────
  const submit = async () => {
    setLoading(true); setError("");
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setError("Not authenticated"); setLoading(false); return; }

    let imageUrl: string | null = null;
    if (photo) {
      const ext = photo.name.split(".").pop() || "jpg";
      const filePath = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await sb.storage
        .from("complaint-images")
        .upload(filePath, photo, { contentType: photo.type, upsert: false });
      if (uploadErr) {
        console.warn("Photo upload failed:", uploadErr.message);
      } else {
        const { data: urlData } = sb.storage.from("complaint-images").getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
    }

    // Use real GPS coords if available, fall back to ward center coords
    const wardFallback = WARD_COORDS[ward] ?? [20.9320, 77.7523];
    const finalLat = gpsCoords?.lat ?? wardFallback[0];
    const finalLng = gpsCoords?.lng ?? wardFallback[1];
    const { data, error: err } = await sb.from("complaints").insert({
      citizen_id: session.user.id,
      title, description: desc, image_url: imageUrl,
      ai_category: cat, ai_department: DEPT_MAP[cat] ?? "GEN",
      department: DEPT_MAP[cat] ?? "GEN",
      ward, address: address || `${ward}, Amravati, Maharashtra`,
      latitude: finalLat,
      longitude: finalLng,
      status: "pending", ai_priority: aiPriority, ai_confidence: 0.90,
      ai_priority_score: aiPriorityScore,
    }).select().single();

    if (err) { setError(err.message); setLoading(false); return; }

    try { await sb.rpc("increment_coins", { p_user_id: session.user.id, p_amount: 10 }); } catch {}
    await sb.from("coin_transactions").insert({
      user_id: session.user.id, complaint_id: data.id, coins: 10, reason: "Complaint submitted",
    });

    // Fire AI moderation pipeline in the background (spam → fake image → priority)
    fetch("/api/ai-moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaint_id: data.id }),
    }).catch((err) => console.warn("[ai-moderation] Background call failed:", err));

    setRefId(data.id.slice(0,8).toUpperCase());
    setLoading(false);
    setStep(4);
  };

  const resetForm = () => {
    setStep(1); setCat(""); setTitle(""); setDesc(""); setWard(""); setAddress("");
    removePhoto(); setTranscript(""); setDetectedLang(""); setAiPriority("Medium"); setAiPriorityScore(50);
  };

  // ── Success Page ─────────────────────────────────────────────
  if (step === 4) return (
    <DashboardLayout>
      <div style={{maxWidth:520,textAlign:"center",padding:"40px 0"}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <h2 style={{fontFamily:"var(--font-syne)",fontSize:24,marginBottom:8}}>Report Submitted!</h2>
        <p style={{color:"var(--text2)",marginBottom:24}}>AMC team will review your complaint shortly.</p>
        <div style={{background:"var(--greenbg)",border:"1px solid var(--green3)",borderRadius:14,padding:20,marginBottom:20}}>
          <div style={{fontFamily:"var(--font-jetbrains)",color:"var(--green)",fontSize:14,marginBottom:6}}>#{refId}</div>
          <div style={{color:"var(--text2)",fontSize:13}}>Reference ID</div>
        </div>
        <div className="alert alert-green" style={{justifyContent:"center"}}>🪙 You earned <strong style={{marginLeft:4}}>+10 EcoCoins!</strong></div>
        <div style={{display:"flex",gap:12,marginTop:24,justifyContent:"center"}}>
          <button className="btn btn-primary" onClick={()=>router.push("/citizen/complaints")}>View My Complaints</button>
          <button className="btn btn-secondary" onClick={resetForm}>Report Another</button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div style={{maxWidth:620}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <h2 style={{fontFamily:"var(--font-syne)",fontSize:20,color:"var(--text)"}}>Report an Issue</h2>
        </div>
        <p style={{color:"var(--text2)",fontSize:13,marginBottom:16}}>Help improve Amravati by reporting civic problems</p>

        {/* Mode toggle */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <button
            className={`btn ${mode==="manual"?"btn-primary":"btn-ghost"}`}
            onClick={()=>setMode("manual")}
            style={{flex:1,fontSize:13}}
          >✏️ Manual Report</button>
          <button
            className={`btn ${mode==="voice"?"btn-primary":"btn-ghost"}`}
            onClick={()=>setMode("voice")}
            style={{flex:1,fontSize:13}}
          >🎤 Voice Report (AI)</button>
        </div>

        {/* ── VOICE MODE ─────────────────────────────────────── */}
        {mode === "voice" && step < 3 && (
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <span style={{fontSize:18}}>🤖</span>
              <h3 style={{fontFamily:"var(--font-syne)",fontSize:14}}>AI Voice Assistant</h3>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"var(--purple)",color:"#fff",fontWeight:600}}>BETA</span>
            </div>

            <p style={{fontSize:12,color:"var(--text2)",marginBottom:16,lineHeight:1.6}}>
              Speak in <strong>Hindi</strong>, <strong>Marathi</strong>, or <strong>English</strong> to describe your complaint.
              AI will auto-fill the form. You only need to upload a photo manually.
            </p>

            {/* Record button */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,marginBottom:16}}>
              {isRecording ? (
                <>
                  <button
                    onClick={stopRecording}
                    style={{width:80,height:80,borderRadius:"50%",border:"3px solid #EF4444",background:"rgba(239,68,68,0.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1.5s infinite"}}
                  >
                    <div style={{width:28,height:28,borderRadius:4,background:"#EF4444"}} />
                  </button>
                  <div style={{fontSize:24,fontFamily:"var(--font-jetbrains)",color:"#EF4444"}}>{formatTime(recordingTime)}</div>
                  <div style={{fontSize:12,color:"var(--text2)"}}>Recording... Click to stop</div>
                </>
              ) : (
                <>
                  <button
                    onClick={startRecording}
                    disabled={transcribing || analyzing}
                    style={{width:80,height:80,borderRadius:"50%",border:"3px solid var(--green)",background:"var(--greenbg)",cursor:transcribing||analyzing?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,transition:"all .2s"}}
                  >🎤</button>
                  <div style={{fontSize:12,color:"var(--text2)"}}>
                    {transcribing ? "⏳ Transcribing..." : analyzing ? "🤖 AI analyzing..." : "Tap to start recording"}
                  </div>
                </>
              )}
            </div>

            {/* Processing indicators */}
            {(transcribing || analyzing) && (
              <div style={{display:"flex",alignItems:"center",gap:10,padding:12,background:"var(--surface2)",borderRadius:10,marginBottom:12}}>
                <div className="spinner" style={{width:16,height:16}} />
                <span style={{fontSize:12,color:"var(--text2)"}}>{transcribing ? "Transcribing your voice..." : "AI is analyzing the complaint..."}</span>
              </div>
            )}

            {/* Transcript result */}
            {transcript && !transcribing && !analyzing && (
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em"}}>Transcript</span>
                  {detectedLang && <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:"var(--surface2)",color:"var(--text2)"}}>{detectedLang.toUpperCase()}</span>}
                </div>
                <div style={{background:"var(--surface2)",borderRadius:8,padding:12,fontSize:13,color:"var(--text2)",lineHeight:1.5,fontStyle:"italic"}}>
                  &ldquo;{transcript}&rdquo;
                </div>
                <div className="alert alert-green" style={{marginTop:8}}>
                  ✅ AI has auto-filled the form below. Review and upload a photo, then submit!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        {step < 4 && (
          <>
            <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
              {[1,2,3].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",flex:i<2?1:0}}>
                  <div className={`step-circle ${step>s?"done":step===s?"active":""}`}>{s}</div>
                  {i<2&&<div className={`step-line ${step>s?"done":""}`}/>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text2)",marginBottom:24}}>
              {["Issue Details","Evidence & Location","Review & Submit"].map((l,i)=>(
                <span key={l} style={{color:step===i+1?"var(--green)":"inherit"}}>{l}</span>
              ))}
            </div>
          </>
        )}

        {/* Step 1 — Issue Details */}
        {step===1&&(
          <div className="card">
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8}}>Category *</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(80px, 1fr))",gap:8,marginBottom:12}}>
                {CATEGORIES.map((c: { emoji: string; label: string })=>(
                  <div key={c.label} className={`cat-btn ${cat===c.label?"active":""}`} onClick={()=>setCat(c.label)}>
                    <div style={{fontSize:22,marginBottom:4}}>{c.emoji}</div>
                    <div style={{fontSize:11,fontWeight:600,color:cat===c.label?"var(--primary)":"var(--text2)"}}>{c.label}</div>
                  </div>
                ))}
              </div>
              {cat&&<div className="alert alert-green">🤖 AI will route to: <strong style={{marginLeft:4}}>{({"PWD":"Public Works","SAN":"Sanitation","DRN":"Drainage","ELC":"Electricity","WTR":"Water Supply","GEN":"General Admin"} as Record<string,string>)[DEPT_MAP[cat]]}</strong></div>}
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:6}}>Title *</label>
              <input className="input" placeholder="e.g. Large pothole on Cotton Market Road" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:6}}>Description</label>
              <textarea className="input" placeholder="Describe the issue in detail..." maxLength={500} value={desc} onChange={e=>setDesc(e.target.value)} rows={3}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button className="btn btn-primary" disabled={!cat||!title} onClick={()=>setStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Evidence & Location */}
        {step===2&&(
          <div className="card">
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8}}>Ward *</label>
              <select className="input" value={ward} onChange={e=>setWard(e.target.value)}>
                <option value="">Select ward...</option>
                {AMRAVATI_WARDS.map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8}}>Address (optional)</label>
              <input className="input" placeholder="e.g. Near Cotton Market, Rajapeth" value={address} onChange={e=>setAddress(e.target.value)}/>
            </div>
            {/* GPS Status */}
            <div style={{marginBottom:16,padding:"10px 14px",borderRadius:12,border:"1px solid",display:"flex",alignItems:"center",gap:8,fontSize:12,
              borderColor: gpsStatus==="done"?"var(--green3)":gpsStatus==="error"?"#FECACA":"var(--border2)",
              background: gpsStatus==="done"?"var(--greenbg)":gpsStatus==="error"?"#FEE2E2":"var(--surface2)",
              color: gpsStatus==="done"?"var(--primary)":gpsStatus==="error"?"var(--red)":"var(--text2)"}}>
              {gpsStatus==="fetching"&&<><div className="spinner" style={{width:14,height:14}}/>Detecting precise GPS location...</>}
              {gpsStatus==="done"&&<>📍 GPS captured: <span style={{fontFamily:"var(--font-jetbrains)",fontSize:11}}>{gpsCoords?.lat.toFixed(5)}, {gpsCoords?.lng.toFixed(5)}</span></>}
              {gpsStatus==="error"&&<>⚠️ GPS unavailable — using ward center coordinates</>}
              {gpsStatus==="idle"&&<>📡 GPS will be captured on this step</>}
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8}}>Photo Evidence</label>
              {/* Camera input — opens device camera directly on mobile */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{display:"none"}} />
              {/* Gallery input — opens file picker / gallery */}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhoto} style={{display:"none"}} />
              {watermarking ? (
                <div style={{borderRadius:14,border:"1.5px dashed var(--green3)",padding:28,textAlign:"center",background:"var(--greenbg)"}}>
                  <div className="spinner" style={{width:24,height:24,margin:"0 auto 12px"}} />
                  <div style={{fontSize:13,fontWeight:500,color:"var(--green)"}}>Applying timestamp & GPS watermark...</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>Fetching location and stamping image</div>
                </div>
              ) : photoPreview ? (
                <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:"2px solid var(--green3)"}}>
                  <img src={photoPreview} alt="Preview" style={{width:"100%",maxHeight:260,objectFit:"cover",display:"block"}} />
                  <button onClick={removePhoto} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  <div style={{background:"var(--greenbg)",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:11,color:"var(--green)",fontWeight:600}}>
                      ✅ Watermarked ({((photo?.size ?? 0) / 1024).toFixed(0)} KB)
                    </div>
                    {photoGps && (
                      <div style={{fontSize:10,color:"var(--text3)",fontFamily:"monospace"}}>
                        📍 {photoGps.lat.toFixed(4)}, {photoGps.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",gap:10}}>
                  <div className="upload-zone" onClick={()=>cameraRef.current?.click()} style={{cursor:"pointer",flex:1}}>
                    <div style={{fontSize:32,marginBottom:8}}>📷</div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>Take Photo</div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>Opens camera</div>
                  </div>
                  <div className="upload-zone" onClick={()=>fileRef.current?.click()} style={{cursor:"pointer",flex:1}}>
                    <div style={{fontSize:32,marginBottom:8}}>🖼️</div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>Gallery</div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>Choose image</div>
                  </div>
                </div>
              )}
            </div>
            {error&&<div className="alert alert-red" style={{marginTop:8}}>{error}</div>}
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={!ward} onClick={()=>{setError("");setStep(3);}}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step===3&&(
          <div className="card">
            <h3 style={{fontFamily:"var(--font-syne)",fontSize:14,marginBottom:16}}>Review your complaint</h3>
            {[
              ["Category", cat],
              ["Title", title],
              ["Description", desc || "—"],
              ["Ward", ward],
              ["Address", address || `${ward}, Amravati`],
              ["Priority", `${aiPriority} (Score: ${aiPriorityScore}/100)`],
              ["Photo", photo ? `✅ Watermarked${photoGps ? ` · 📍 ${photoGps.lat.toFixed(4)}, ${photoGps.lng.toFixed(4)}` : ""}` : "No photo attached"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:12,color:"var(--text3)",width:90,flexShrink:0}}>{k}</span>
                <span style={{fontSize:13,flex:1}}>{v}</span>
              </div>
            ))}
            {photoPreview && (
              <div style={{marginTop:12,borderRadius:10,overflow:"hidden"}}>
                <img src={photoPreview} alt="Preview" style={{width:"100%",maxHeight:160,objectFit:"cover"}} />
              </div>
            )}
            {transcript && (
              <div style={{marginTop:12,padding:10,background:"var(--surface2)",borderRadius:8,fontSize:12,color:"var(--text2)"}}>
                🎤 <strong>Voice transcript:</strong> &ldquo;{transcript}&rdquo;
              </div>
            )}
            {error&&<div className="alert alert-red" style={{marginTop:12}}>{error}</div>}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setStep(2)}>← Back</button>
              <button className="btn btn-primary" disabled={loading} onClick={submit}>
                {loading?<span className="spinner" style={{width:16,height:16}}/>:"🚀 Submit Report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
