export interface LLMProvider {
  chat(prompt: string, systemPrompt?: string): Promise<string>;
  extractJSON<T = unknown>(prompt: string, systemPrompt?: string): Promise<T>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
  embeddingProvider: string;
}

export function parseJSON<T>(text: string): T {
  // Try to extract JSON from text that might contain markdown fences or extra text
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();

  // Try parsing the cleaned text directly
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find a JSON object or array in the text
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[1]) as T;
    }
    throw new Error("Could not parse JSON from response");
  }
}
