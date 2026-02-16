import { NextResponse } from "next/server";
import { getLLM } from "@/lib/llm/provider";

export async function POST() {
  try {
    const llm = getLLM();
    const response = await llm.chat("Say 'Hello from ClawCRM!' in exactly those words.");
    if (response) {
      return NextResponse.json({ success: true, response });
    }
    return NextResponse.json({ success: false, error: "Empty response" });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
