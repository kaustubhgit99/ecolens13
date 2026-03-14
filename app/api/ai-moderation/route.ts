import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow more time for 3 sequential AI calls

// ── Supabase service-role client (server-side only) ───────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Gemini API helper ─────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(parts: GeminiPart[]): Promise<string> {
  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[ai-moderation] Gemini API error:", resp.status, errText);
    throw new Error(`Gemini API error: ${resp.status}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    // Try to find a JSON block (handles markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[ai-moderation] JSON parse failed:", e, "Raw:", text);
  }
  return null;
}

// ── Fetch image as base64 ─────────────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const buffer = await resp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, mimeType: contentType };
  } catch (e) {
    console.error("[ai-moderation] Image fetch failed:", e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 1: Spam Detection
// ══════════════════════════════════════════════════════════════════
async function detectSpam(
  title: string,
  description: string,
  citizenId: string,
  recentCount: number
): Promise<{ is_spam: boolean; reason: string; confidence: number }> {
  const prompt = `You are a civic complaint moderation AI.
Determine if the complaint text is spam, nonsense, abusive, or repeated.

Complaint Title: "${title}"
Complaint Description: "${description}"
Number of complaints from this user in the last 24 hours: ${recentCount}

Consider the following:
- Detect meaningless text (examples: "test", "abc", "111", "aaaa", random gibberish)
- Detect abusive or inappropriate language
- If the user has submitted more than 10 complaints in 24 hours, flag as excessive frequency
- Short, vague titles with no real content are likely spam

Return STRICT JSON (no markdown, no extra text):
{
  "is_spam": true/false,
  "reason": "short explanation",
  "confidence": 0-100
}`;

  console.log("[ai-moderation] Running spam detection...");
  const response = await callGemini([{ text: prompt }]);
  const parsed = extractJSON(response);

  if (parsed) {
    return {
      is_spam: Boolean(parsed.is_spam),
      reason: String(parsed.reason || ""),
      confidence: Number(parsed.confidence) || 0,
    };
  }

  return { is_spam: false, reason: "AI analysis inconclusive", confidence: 0 };
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 2: Fake / AI Image Detection
// ══════════════════════════════════════════════════════════════════
async function detectFakeImage(
  imageUrl: string
): Promise<{ is_ai_generated: boolean; manipulated: boolean; confidence: number; explanation: string }> {
  const imageData = await fetchImageAsBase64(imageUrl);
  if (!imageData) {
    console.log("[ai-moderation] Could not fetch image, skipping image analysis");
    return { is_ai_generated: false, manipulated: false, confidence: 0, explanation: "Image could not be fetched for analysis" };
  }

  const prompt = `You are an AI image forensic system.
Determine whether the image is a real photograph, AI-generated image, or digitally manipulated.

Look for:
- AI generation artifacts (perfect symmetry, unusual textures, artifacts in details like hands/text)
- Signs of digital manipulation (inconsistent lighting, cloning artifacts, splicing edges)
- Whether it appears to be a genuine photograph of a civic infrastructure issue

Return STRICT JSON (no markdown, no extra text):
{
  "is_ai_generated": true/false,
  "manipulated": true/false,
  "confidence": 0-100,
  "explanation": "short reason"
}`;

  console.log("[ai-moderation] Running fake image detection...");
  const response = await callGemini([
    { text: prompt },
    { inline_data: { mime_type: imageData.mimeType, data: imageData.base64 } },
  ]);
  const parsed = extractJSON(response);

  if (parsed) {
    return {
      is_ai_generated: Boolean(parsed.is_ai_generated),
      manipulated: Boolean(parsed.manipulated),
      confidence: Number(parsed.confidence) || 0,
      explanation: String(parsed.explanation || ""),
    };
  }

  return { is_ai_generated: false, manipulated: false, confidence: 0, explanation: "AI analysis inconclusive" };
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 3: Priority Classification
// ══════════════════════════════════════════════════════════════════
async function classifyPriority(
  title: string,
  description: string,
  aiCategory: string | null,
  location: string | null
): Promise<{ priority: string; priority_score: number; reason: string }> {
  const prompt = `You are an AI used by a municipal government to classify complaint priority.

Complaint Title: "${title}"
Complaint Description: "${description || "No description provided"}"
Category: "${aiCategory || "Unknown"}"
Location: "${location || "Not specified"}"

Priorities:
- Critical: Life-threatening situations, major infrastructure failure, public safety hazards
- High: Significant issues affecting daily life, health risks, urgent repairs needed
- Moderate: Important issues that need attention but aren't immediately dangerous
- Medium: Standard civic issues that should be addressed in normal course
- Low: Minor inconveniences, cosmetic issues, suggestions

Return STRICT JSON (no markdown, no extra text):
{
  "priority": "Critical|High|Moderate|Medium|Low",
  "priority_score": 0-100,
  "reason": "short explanation"
}`;

  console.log("[ai-moderation] Running priority classification...");
  const response = await callGemini([{ text: prompt }]);
  const parsed = extractJSON(response);

  if (parsed) {
    const validPriorities = ["Critical", "High", "Moderate", "Medium", "Low"];
    const priority = validPriorities.includes(String(parsed.priority))
      ? String(parsed.priority)
      : "Medium";
    return {
      priority,
      priority_score: Math.max(0, Math.min(100, Number(parsed.priority_score) || 50)),
      reason: String(parsed.reason || ""),
    };
  }

  return { priority: "Medium", priority_score: 50, reason: "AI analysis inconclusive" };
}

// ══════════════════════════════════════════════════════════════════
// POST handler — orchestrates all 3 AI features
// ══════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { complaint_id } = body;

    if (!complaint_id) {
      return NextResponse.json({ error: "complaint_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the complaint
    const { data: complaint, error: fetchErr } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", complaint_id)
      .single();

    if (fetchErr || !complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const results: Record<string, unknown> = {
      complaint_id,
      spam: null,
      image_analysis: null,
      priority: null,
    };

    // ────────────────────────────────────────────────────────────
    // STEP 1: Spam Detection
    // ────────────────────────────────────────────────────────────
    // Count recent complaints from this user (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("citizen_id", complaint.citizen_id)
      .gte("created_at", twentyFourHoursAgo);

    const spamResult = await detectSpam(
      complaint.title || "",
      complaint.description || "",
      complaint.citizen_id,
      recentCount ?? 0
    );
    results.spam = spamResult;

    console.log("[ai-moderation] Spam result:", spamResult);

    if (spamResult.is_spam && spamResult.confidence >= 60) {
      // Reject the complaint as spam
      await supabase
        .from("complaints")
        .update({
          status: "rejected",
          resolution_notes: `Detected as spam by AI: ${spamResult.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint_id);

      console.log("[ai-moderation] Complaint rejected as spam:", complaint_id);

      return NextResponse.json({
        ...results,
        action: "rejected_spam",
        message: "Complaint detected as spam and rejected",
      });
    }

    // ────────────────────────────────────────────────────────────
    // STEP 2: Fake Image Detection (only if image exists)
    // ────────────────────────────────────────────────────────────
    if (complaint.image_url) {
      const imageResult = await detectFakeImage(complaint.image_url);
      results.image_analysis = imageResult;

      console.log("[ai-moderation] Image analysis result:", imageResult);

      if (
        (imageResult.is_ai_generated || imageResult.manipulated) &&
        imageResult.confidence >= 70
      ) {
        // Reject the complaint for fake image
        await supabase
          .from("complaints")
          .update({
            status: "rejected",
            resolution_notes: `Image flagged as AI-generated or manipulated: ${imageResult.explanation}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", complaint_id);

        console.log("[ai-moderation] Complaint rejected for fake image:", complaint_id);

        return NextResponse.json({
          ...results,
          action: "rejected_fake_image",
          message: "Complaint image flagged as AI-generated or manipulated",
        });
      }
    } else {
      results.image_analysis = { skipped: true, reason: "No image attached" };
    }

    // ────────────────────────────────────────────────────────────
    // STEP 3: Priority Classification
    // ────────────────────────────────────────────────────────────
    const location = [complaint.address, complaint.ward].filter(Boolean).join(", ");
    const priorityResult = await classifyPriority(
      complaint.title || "",
      complaint.description || "",
      complaint.ai_category,
      location
    );
    results.priority = priorityResult;

    console.log("[ai-moderation] Priority result:", priorityResult);

    // Update complaint with AI priority
    await supabase
      .from("complaints")
      .update({
        ai_priority: priorityResult.priority,
        ai_priority_score: priorityResult.priority_score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", complaint_id);

    return NextResponse.json({
      ...results,
      action: "processed",
      message: "All AI checks passed. Priority assigned.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-moderation] Internal error:", msg);
    return NextResponse.json(
      { error: "AI moderation failed", details: msg },
      { status: 500 }
    );
  }
}
