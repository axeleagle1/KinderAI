import { detectModeFree } from "../../../lib/ai/modes";
import { respondFree } from "../../../lib/ai/respondFree";

type Tier = "lite" | "pro";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;
    const tier: Tier = body?.tier === "pro" ? "pro" : "lite";

    if (!message || typeof message !== "string") {
      return Response.json({ reply: "Message is required." }, { status: 400 });
    }

    // optional: small delay
    await new Promise((r) => setTimeout(r, 250));

    const { mode, reason } = detectModeFree(message);

    // For now, Pro is locked, so always use Free logic
    const payload = respondFree(mode, message);

    return Response.json({
      reply: payload.reply,
      quickReplies: payload.quickReplies,
      mode,
      reason,
      tierUsed: tier, // helpful for debugging UI
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return Response.json({ reply: "Something went wrong." }, { status: 500 });
  }
}