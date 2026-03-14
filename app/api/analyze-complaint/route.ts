import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const CATEGORIES = [
  "Road Damage", "Garbage", "Sewage", "Lighting",
  "Water Supply", "Air Quality", "Noise", "Other",
];

const DEPT_MAP: Record<string, string> = {
  "Road Damage": "PWD", "Garbage": "SAN", "Sewage": "DRN", "Lighting": "ELC",
  "Water Supply": "WTR", "Air Quality": "GEN", "Noise": "GEN", "Other": "GEN",
};

const WARDS = [
  "Ward 1 - Rajapeth", "Ward 2 - Jaistambh Chowk", "Ward 3 - Wadali", "Ward 4 - Cidco",
  "Ward 5 - Garoba Maidan", "Ward 6 - Panchsheel Nagar", "Ward 7 - Shivnagar",
  "Ward 8 - Laxmi Nagar", "Ward 9 - Venkatesh Nagar", "Ward 10 - Jawahar Gate",
  "Ward 11 - Gandhi Gate", "Ward 12 - Prabhat Square", "Ward 13 - Camp Area",
  "Ward 14 - Tapadia Nagar", "Ward 15 - Badnera",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transcript = body.transcript;
    const language = body.language || "auto";

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an AI assistant for EcoLens, a civic complaint platform for Amravati city, Maharashtra, India.

Analyze the user's voice complaint (which may be in Hindi, Marathi, or English) and extract structured information.

You MUST respond ONLY with a valid JSON object. No markdown, no code fences, no extra text.
{
  "title": "Short complaint title in English (max 80 chars)",
  "description": "Detailed description in English (max 300 chars)",
  "category": "One of: ${CATEGORIES.join(", ")}",
  "ward": "Best matching ward or empty string. Available: ${WARDS.join(", ")}",
  "address": "Specific location mentioned, or empty string",
  "priority": "High or Medium or Low",
  "priority_score": 50
}

Rules:
- Always translate content to English for title and description
- Pick the most relevant category from the list
- If a location/area is mentioned, try to match it to a ward
- Assess priority based on safety risk and urgency
- priority_score is a number from 1 to 100`;

    console.log("[analyze] Sending transcript to GROQ LLM, length:", transcript.length);

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Voice complaint transcript (detected language: ${language}):\n\n"${transcript}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("[analyze] GROQ error:", resp.status, errBody);
      // Return fallback data instead of failing
      return NextResponse.json({
        title: transcript.slice(0, 80),
        description: transcript.slice(0, 300),
        category: "Other",
        ward: "",
        address: "",
        priority: "Medium",
        priority_score: 50,
        department: "GEN",
        _fallback: true,
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log("[analyze] LLM response:", content.slice(0, 200));

    // Parse JSON from LLM response
    let parsed;
    try {
      // Try extracting JSON block (handles markdown fences like ```json ... ```)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseErr) {
      console.error("[analyze] JSON parse failed:", parseErr, "Raw:", content);
      return NextResponse.json({
        title: transcript.slice(0, 80),
        description: transcript.slice(0, 300),
        category: "Other",
        ward: "",
        address: "",
        priority: "Medium",
        priority_score: 50,
        department: "GEN",
        _fallback: true,
      });
    }

    // Validate and sanitize
    if (!CATEGORIES.includes(parsed.category)) parsed.category = "Other";
    if (parsed.ward && !WARDS.includes(parsed.ward)) parsed.ward = "";
    if (!["High", "Medium", "Low"].includes(parsed.priority)) parsed.priority = "Medium";
    parsed.priority_score = Math.max(1, Math.min(100, Number(parsed.priority_score) || 50));
    parsed.department = DEPT_MAP[parsed.category] ?? "GEN";

    console.log("[analyze] Result:", parsed.title, "| Category:", parsed.category, "| Priority:", parsed.priority);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze] Internal error:", msg);
    return NextResponse.json({ error: "Internal server error", details: msg }, { status: 500 });
  }
}
