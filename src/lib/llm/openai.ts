import type { LLMProvider, EmbeddingProvider, LLMSettings } from "./types";
import { parseJSON } from "./types";

export class OpenAIProvider implements LLMProvider, EmbeddingProvider {
  constructor(private settings: LLMSettings) {}

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model || "gpt-4o-mini",
        messages,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async extractJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const sys = (systemPrompt || "") + "\nRespond ONLY with valid JSON. No markdown fences, no explanation.";
    const text = await this.chat(prompt, sys);
    return parseJSON<T>(text);
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }
}
