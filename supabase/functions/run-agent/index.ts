// functions/run-agent/index.ts
// AI Form Auto-Fill: extracts fields from rental application PDFs and fills from profile
import { handleCors, corsResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { chatWithVision } from "../_shared/openai.ts";

const ANALYZE_PROMPT = `You are analyzing a rental application form.
Extract ALL form fields that need to be filled. For each field, determine:
- The field label/question
- The current value (if already filled on the form)
- Whether it's "filled" (you can fill from profile data), "review" (needs user to check), or "missing" (needs user input)

IMPORTANT RULES:
1. Only mark as "filled" if you have HIGH confidence the profile data matches exactly
2. For fields where the answer isn't clear from profile data, mark as "review" with a note suggesting what to enter
3. For fields with no profile data at all, mark as "missing" — the user will fill these interactively
4. ALWAYS include a helpful "note" for "review" fields suggesting what to enter

Return ONLY a JSON object with this structure:
{
  "form_title": "Name of the form",
  "fields": [
    {
      "label": "Full Name",
      "value": "John Smith",
      "status": "filled",
      "source": "passport",
      "note": "Verified from passport"
    },
    {
      "label": "Previous Address",
      "value": "",
      "status": "review",
      "source": null,
      "note": "Provide your address from the last 3 years"
    }
  ],
  "summary": "Brief summary of what was filled and what needs attention"
}`;

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const ctx = await verifyAuth(req);
    if (!ctx) return corsResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { fileDataUrl, fileName } = body;

    if (!fileDataUrl?.startsWith("data:")) {
      return corsResponse({ error: "fileDataUrl must be a data: URL" }, 400);
    }

    // 1. Fetch user's profile from extractions
    const { data: extractions } = await ctx.supabase
      .from("extractions")
      .select("data")
      .eq("user_id", ctx.userId);

    const profileData: Record<string, string> = {};
    for (const e of (extractions ?? [])) {
      if (e.data && typeof e.data === "object") {
        Object.assign(profileData, e.data);
      }
    }

    // Build profile context
    const profileContext = Object.entries(profileData)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const fullPrompt = `${ANALYZE_PROMPT}

USER'S VERIFIED PROFILE DATA:
${profileContext || "(No profile data available yet — upload documents first)"}

Extract the form fields and fill them using the profile data above.`;

    // 2. Parse the data URL to get base64
    const [header, b64] = fileDataUrl.split(",", 2);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch?.[1] ?? "application/pdf";

    // 3. Send to OpenAI Vision
    const result = await chatWithVision(fullPrompt, b64, mimeType);

    // 4. Parse JSON result
    let parsed: any;
    try {
      const cleaned = result.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return corsResponse({
        form_title: fileName || "Rental Application",
        fields: [],
        summary: "Could not parse the form. Please try a clearer scan.",
      });
    }

    return corsResponse(parsed);
  } catch (err) {
    console.error("run-agent error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});
