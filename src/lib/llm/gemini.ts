import type { LLMProvider, EmbeddingProvider, LLMSettings } from "./types";
import { parseJSON } from "./types";

export class GeminiProvider implements LLMProvider, EmbeddingProvider {
  constructor(private settings: LLMSettings) {}

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const model = this.settings.model || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async extractJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const sys = (systemPrompt || "") + "\nRespond ONLY with valid JSON. No markdown fences, no explanation.";
    const text = await this.chat(prompt, sys);
    return parseJSON<T>(text);
  }

  async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.settings.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Embedding error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.embedding?.values || [];
  }
}
