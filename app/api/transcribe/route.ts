import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ API key not configured" }, { status: 500 });
    }

    // Convert the File to a Buffer, then create a proper Blob for fetch
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalType = audioFile.type || "audio/webm";
    const originalName = audioFile.name || "recording.webm";

    console.log("[transcribe] Received file:", originalName, "type:", originalType, "size:", buffer.length);

    // Build FormData for GROQ API
    const groqFormData = new FormData();
    const blob = new Blob([buffer], { type: originalType });
    groqFormData.append("file", blob, originalName);
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("response_format", "verbose_json");

    console.log("[transcribe] Sending audio to GROQ, size:", buffer.length, "bytes");

    const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("[transcribe] GROQ error:", resp.status, errBody);
      return NextResponse.json(
        { error: "Transcription failed", details: errBody },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    console.log("[transcribe] Success! Language:", data.language, "Text length:", data.text?.length);

    return NextResponse.json({
      transcript: data.text || "",
      language: data.language || "unknown",
      duration: data.duration || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[transcribe] Internal error:", msg);
    return NextResponse.json({ error: "Internal server error", details: msg }, { status: 500 });
  }
}
