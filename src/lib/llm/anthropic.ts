import type { LLMProvider, LLMSettings } from "./types";
import { parseJSON } from "./types";

export class AnthropicProvider implements LLMProvider {
  constructor(private settings: LLMSettings) {}

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.settings.model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    return textBlock?.text || "";
  }

  async extractJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const sys = (systemPrompt || "") + "\nRespond ONLY with valid JSON. No markdown fences, no explanation.";
    const text = await this.chat(prompt, sys);
    return parseJSON<T>(text);
  }
}
