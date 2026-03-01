import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { message } = await req.json();

  return NextResponse.json({
    reply: `Got it: "${message}". (API not connected yet)`,
    quickReplies: ["Get clarity", "Make a plan", "Calm down"],
  });
}