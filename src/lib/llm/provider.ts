import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { LLMProvider, EmbeddingProvider, LLMSettings } from "./types";
import { FallbackProvider } from "./fallback";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

/**
 * Load LLM settings from database
 */
export function getSettings(): LLMSettings {
  const getVal = (key: string): string => {
    const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    return row?.value || "";
  };

  return {
    provider: getVal("llm_provider") || "fallback",
    model: getVal("llm_model") || "",
    apiKey: getVal("llm_api_key") || "",
    embeddingProvider: getVal("embedding_provider") || "fallback",
  };
}

/**
 * Get the configured LLM provider (for chat / JSON extraction)
 */
export function getLLM(): LLMProvider {
  const settings = getSettings();

  // If no API key is configured, always use fallback
  if (!settings.apiKey && settings.provider !== "fallback") {
    return new FallbackProvider();
  }

  switch (settings.provider) {
    case "openai":
      return new OpenAIProvider(settings);
    case "anthropic":
      return new AnthropicProvider(settings);
    case "gemini":
    case "google":
      return new GeminiProvider(settings);
    case "fallback":
    default:
      return new FallbackProvider();
  }
}

/**
 * Get the configured embedding provider
 */
export function getEmbedder(): EmbeddingProvider {
  const settings = getSettings();

  // Embedding providers
  if (settings.embeddingProvider === "openai" && settings.apiKey) {
    return new OpenAIProvider(settings);
  }
  if (
    (settings.embeddingProvider === "gemini" || settings.embeddingProvider === "google") &&
    settings.apiKey
  ) {
    return new GeminiProvider(settings);
  }

  // Default: local TF-IDF fallback
  return new FallbackProvider();
}
