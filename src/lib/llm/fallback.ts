import type { LLMProvider, EmbeddingProvider } from "./types";
import { generateLocalEmbedding, tokenize, extractKeywords } from "./embeddings";

/**
 * Fallback LLM provider that works entirely offline using keyword extraction,
 * TF-IDF embeddings, and pattern matching. No API keys required.
 */
export class FallbackProvider implements LLMProvider, EmbeddingProvider {
  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const combined = (systemPrompt || "") + "\n" + prompt;

    // Detect intent and generate appropriate response
    if (this.isMeetingExtraction(combined)) {
      return this.handleMeetingExtraction(prompt);
    }

    if (this.isPersonMdGeneration(combined)) {
      return this.handlePersonMdGeneration(prompt);
    }

    // Generic summarization
    return this.handleGenericSummary(prompt);
  }

  async extractJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const combined = (systemPrompt || "") + "\n" + prompt;

    if (this.isMeetingExtraction(combined)) {
      // Check if multi-person extraction is requested
      if (combined.includes("names") && combined.includes("array")) {
        return this.extractMultiMeetingData(prompt) as T;
      }
      return this.extractMeetingData(prompt) as T;
    }

    // Fallback: return empty object
    return {} as T;
  }

  async embed(text: string): Promise<number[]> {
    return generateLocalEmbedding(text);
  }

  // --- Intent detection ---

  private isMeetingExtraction(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      (lower.includes("extract") || lower.includes("parse") || lower.includes("analyze")) &&
      (lower.includes("meeting") || lower.includes("note") || lower.includes("conversation"))
    );
  }

  private isPersonMdGeneration(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      (lower.includes("markdown") || lower.includes("summary") || lower.includes("profile")) &&
      (lower.includes("person") || lower.includes("contact"))
    );
  }

  // --- Meeting extraction ---

  private extractMultiMeetingData(prompt: string): {
    names: string[];
    summary: string;
    topics: string[];
  } {
    const names = this.extractAllPersonNames(prompt);
    const summary = this.extractSummary(prompt);
    const topics = this.extractTopics(prompt);

    return { names, summary, topics };
  }

  private extractMeetingData(prompt: string): {
    name: string;
    summary: string;
    topics: string[];
  } {
    const name = this.extractPersonName(prompt);
    const summary = this.extractSummary(prompt);
    const topics = this.extractTopics(prompt);

    return { name, summary, topics };
  }

  private handleMeetingExtraction(prompt: string): string {
    const data = this.extractMeetingData(prompt);
    return JSON.stringify(data);
  }

  /**
   * Extract person name from meeting text using common patterns.
   */
  private extractPersonName(text: string): string {
    // Common patterns: "with [Name]", "met [Name]", "[Name] told/said/mentioned"
    const patterns = [
      /(?:with|met|saw|called|emailed|texted|messaged|visited|contacted)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){0,3})/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:told|said|mentioned|showed|shared|offered|suggested|introduced|asked|explained)/g,
      /(?:call|meeting|chat|conversation|discussion|lunch|dinner|coffee|drinks)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){0,3})/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:from|at|of)\s+/g,
      /(?:^|\.\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:and I|is|was|has)/g,
    ];

    const names: Record<string, number> = {};
    const skipWords = new Set([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      "January", "February", "March", "April", "May", "June", "July", "August",
      "September", "October", "November", "December", "Today", "Yesterday",
      "Tomorrow", "Zoom", "Google", "Microsoft", "Apple", "Amazon", "The",
      "This", "That", "These", "Those", "Here", "There", "Had", "Got",
    ]);

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const firstName = name.split(" ")[0];
        if (!skipWords.has(firstName) && name.length > 2) {
          names[name] = (names[name] || 0) + 1;
        }
      }
    }

    // Return the most frequently mentioned name
    const sorted = Object.entries(names).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "Unknown Person";
  }

  /**
   * Extract ALL person names from meeting text.
   */
  private extractAllPersonNames(text: string): string[] {
    const patterns = [
      /(?:with|met|saw|called|emailed|texted|messaged|visited|contacted)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){0,3})/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:told|said|mentioned|showed|shared|offered|suggested|introduced|asked|explained)/g,
      /(?:call|meeting|chat|conversation|discussion|lunch|dinner|coffee|drinks)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){0,3})/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:from|at|of)\s+/g,
      /(?:^|\.\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z''-]+){1,3})\s+(?:and I|is|was|has)/g,
    ];

    const names: Record<string, number> = {};
    const skipWords = new Set([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      "January", "February", "March", "April", "May", "June", "July", "August",
      "September", "October", "November", "December", "Today", "Yesterday",
      "Tomorrow", "Zoom", "Google", "Microsoft", "Apple", "Amazon", "The",
      "This", "That", "These", "Those", "Here", "There", "Had", "Got",
    ]);

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const firstName = name.split(" ")[0];
        if (!skipWords.has(firstName) && name.length > 2) {
          names[name] = (names[name] || 0) + 1;
        }
      }
    }

    const sorted = Object.entries(names).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return ["Unknown Person"];
    return sorted.map(([name]) => name);
  }

  /**
   * Extract a summary from the text (first 1-2 sentences, cleaned up)
   */
  private extractSummary(text: string): string {
    // Get the core meeting text (after any instruction/prompt part)
    const meetingText = this.getMeetingText(text);
    const sentences = meetingText
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length === 0) return meetingText.slice(0, 200);

    // Take first 2 sentences as summary
    const summary = sentences.slice(0, 2).join(". ") + ".";
    return summary.length > 300 ? summary.slice(0, 297) + "..." : summary;
  }

  /**
   * Extract topics using keyword frequency analysis
   */
  private extractTopics(text: string): string[] {
    const meetingText = this.getMeetingText(text);
    const keywords = extractKeywords(meetingText, 15).filter((kw) => !isPromptWord(kw));

    // Group related keywords into topic phrases
    const topics: string[] = [];
    const words = tokenize(meetingText);

    // Find noun phrases and compound terms
    const bigramFreq: Record<string, number> = {};
    for (let i = 0; i < words.length - 1; i++) {
      if (!isStopWord(words[i]) && !isStopWord(words[i + 1]) && !isPromptWord(words[i]) && !isPromptWord(words[i + 1])) {
        const bigram = words[i] + " " + words[i + 1];
        bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
      }
    }

    // Add top bigrams as topics
    const topBigrams = Object.entries(bigramFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bg]) => bg);

    topics.push(...topBigrams);

    // Add remaining single keywords not covered by bigrams
    for (const kw of keywords) {
      if (!topics.some((t) => t.includes(kw))) {
        topics.push(kw);
      }
      if (topics.length >= 8) break;
    }

    return topics.slice(0, 8);
  }

  /**
   * Try to extract just the meeting text from a prompt that might contain instructions
   */
  private getMeetingText(prompt: string): string {
    // Look for common delimiters that separate instructions from content
    const markers = [
      "meeting note:", "meeting text:", "meeting notes:", "note:", "text:", "input:",
      "---", "```", "here is", "here's the", "transcript:",
      "content:", "the following",
    ];
    const lower = prompt.toLowerCase();

    // Try markers - pick the last one found to skip past all instructions
    let bestIdx = -1;
    let bestMarkerLen = 0;
    for (const marker of markers) {
      const idx = lower.indexOf(marker);
      if (idx !== -1 && idx > bestIdx) {
        bestIdx = idx;
        bestMarkerLen = marker.length;
      }
    }
    if (bestIdx !== -1) {
      const extracted = prompt.slice(bestIdx + bestMarkerLen).replace(/^[\s`\-:]+/, "").trim();
      if (extracted.length > 20) return extracted;
    }

    // Strip lines that look like instructions (imperative sentences with JSON/extract/return etc)
    const lines = prompt.split("\n");
    const contentLines = lines.filter((line) => {
      const l = line.toLowerCase().trim();
      if (l.length === 0) return false;
      // Skip lines that are clearly instructions
      if (/^(extract|analyze|parse|return|provide|generate|create|output|identify|list|find)\b/i.test(l)) return false;
      if (/\bjson\b/.test(l) && /\b(return|format|valid|object|array)\b/.test(l)) return false;
      return true;
    });

    return contentLines.join("\n").trim() || prompt;
  }

  // --- Person markdown generation ---

  private handlePersonMdGeneration(prompt: string): string {
    // Extract person details from prompt context
    const nameMatch = prompt.match(/name[:\s]+([^\n,]+)/i);
    const name = nameMatch?.[1]?.trim() || "Unknown";
    const companyMatch = prompt.match(/company[:\s]+([^\n,]+)/i);
    const company = companyMatch?.[1]?.trim();
    const roleMatch = prompt.match(/role[:\s]+([^\n,]+)/i);
    const role = roleMatch?.[1]?.trim();

    let md = `# ${name}\n\n`;
    if (role && company) {
      md += `**${role}** at ${company}\n\n`;
    } else if (role) {
      md += `**${role}**\n\n`;
    } else if (company) {
      md += `Works at ${company}\n\n`;
    }

    // Extract topics/interests from the meetings context
    const keywords = extractKeywords(prompt, 10);
    if (keywords.length > 0) {
      md += `## Key Topics\n`;
      for (const kw of keywords.slice(0, 6)) {
        md += `- ${kw}\n`;
      }
      md += "\n";
    }

    md += `## Notes\n- Profile auto-generated from meeting notes\n`;

    return md;
  }

  // --- Generic summary ---

  private handleGenericSummary(prompt: string): string {
    const sentences = prompt
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length <= 3) return prompt;
    return sentences.slice(0, 3).join(". ") + ".";
  }
}

const PROMPT_WORDS = new Set([
  "extract", "analyze", "meeting", "note", "json", "return", "object", "array",
  "summary", "topics", "names", "person", "keyword", "phrase", "brief",
  "sentence", "information", "data", "valid", "following", "mentioned",
  "conversation", "discussed", "include", "distinct", "parse",
]);

function isPromptWord(word: string): boolean {
  return PROMPT_WORDS.has(word.toLowerCase());
}

function isStopWord(word: string): boolean {
  const stops = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "i", "me", "my", "we", "our", "you", "your",
    "he", "him", "she", "her", "it", "they", "them", "their", "about",
    "extract", "analyze", "meeting", "note", "json", "return", "object", "array",
    "summary", "topics", "names", "person", "keyword", "phrase", "brief",
    "sentence", "information", "data", "valid", "following", "mentioned",
    "conversation", "discussed", "include", "distinct", "parse",
  ]);
  return stops.has(word.toLowerCase());
}
