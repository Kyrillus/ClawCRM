// Embedding utilities: TF-IDF vector generation, cosine similarity, buffer serialization

const EMBEDDING_DIMS = 384;

// Common English stop words to filter out
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "ought", "used", "i", "me", "my", "we", "our", "you", "your", "he",
  "him", "his", "she", "her", "it", "its", "they", "them", "their",
  "what", "which", "who", "whom", "this", "that", "these", "those",
  "am", "been", "about", "above", "after", "again", "against", "all",
  "any", "because", "before", "below", "between", "both", "during",
  "each", "few", "further", "here", "how", "into", "just", "more",
  "most", "no", "nor", "not", "only", "other", "out", "over", "own",
  "same", "so", "some", "such", "than", "then", "there", "through",
  "too", "under", "until", "up", "very", "s", "t", "don", "ll", "ve",
  "re", "d", "m", "o", "ain", "aren", "couldn", "didn", "doesn",
  "hadn", "hasn", "haven", "isn", "ma", "mightn", "mustn", "needn",
  "shan", "shouldn", "wasn", "weren", "won", "wouldn",
]);

/**
 * Tokenize text into meaningful words
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Extract keywords from text using TF-based scoring
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  const words = tokenize(text);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Generate a TF-IDF-like embedding vector using deterministic hashing.
 * Works entirely offline without any API calls.
 */
export function generateLocalEmbedding(text: string): number[] {
  const words = tokenize(text);
  const embedding = new Float64Array(EMBEDDING_DIMS);

  if (words.length === 0) return Array.from(embedding);

  // Count word frequencies
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // For each unique word, hash it to multiple dimensions with TF weight
  for (const [word, count] of Object.entries(freq)) {
    const tf = count / words.length;

    // Use multiple hash functions to distribute each word across dimensions
    for (let h = 0; h < 3; h++) {
      let hash = h * 2654435761;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % EMBEDDING_DIMS;
      // Alternate sign based on another hash to reduce collisions
      const sign = ((hash >> 16) & 1) === 0 ? 1 : -1;
      embedding[idx] += sign * tf;
    }

    // Also add bigram features if word is part of a bigram
    const wordIdx = words.indexOf(word);
    if (wordIdx < words.length - 1) {
      const bigram = word + "_" + words[wordIdx + 1];
      let bHash = 0x811c9dc5;
      for (let i = 0; i < bigram.length; i++) {
        bHash ^= bigram.charCodeAt(i);
        bHash = Math.imul(bHash, 0x01000193);
      }
      const bIdx = Math.abs(bHash) % EMBEDDING_DIMS;
      embedding[bIdx] += tf * 0.5;
    }
  }

  // L2 normalize
  let magnitude = 0;
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIMS; i++) {
      embedding[i] /= magnitude;
    }
  }

  return Array.from(embedding);
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Serialize embedding array to Buffer for SQLite blob storage
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeFloatLE(embedding[i], i * 4);
  }
  return buffer;
}

/**
 * Deserialize Buffer from SQLite back to embedding array
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}
