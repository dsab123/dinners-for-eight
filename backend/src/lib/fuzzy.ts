/**
 * Small dependency-free fuzzy name matcher. Good enough to line up a
 * signed-in person's name against a church directory even with typos,
 * middle names, accents, or "Last First" ordering.
 */

/** Lowercase, strip accents/punctuation, collapse whitespace. */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // strip combining diacritic marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity in [0,1]: 1 is identical, 0 is completely different. */
function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** A single token must clear this to count as "present" in the query. */
const PER_TOKEN_THRESHOLD = 0.85;

/**
 * Directional: do ALL of the candidate's tokens appear (fuzzily) somewhere in
 * the query's tokens? Returns the average per-token similarity, or 0 if any
 * candidate token is missing. This is what lets a last-name-only directory
 * entry ("Anderson") match a full-name sign-in ("John Anderson"), while
 * keeping "Tim Rogers" from matching a query of "Beth Rogers" (the "tim" token
 * isn't present).
 */
function tokenSubsetScore(queryTokens: string[], candTokens: string[]): number {
  if (candTokens.length === 0) return 0;
  let total = 0;
  for (const ct of candTokens) {
    let best = 0;
    for (const qt of queryTokens) best = Math.max(best, ratio(ct, qt));
    if (best < PER_TOKEN_THRESHOLD) return 0; // a required token is absent
    total += best;
  }
  return total / candTokens.length;
}

/**
 * How well `candidate` (a directory name) matches `query` (the signed-in
 * person's name). Order-insensitive, tolerant of typos/accents, and matches
 * when the candidate's tokens are a subset of the query's (last-name entries).
 */
export function nameSimilarity(query: string, candidate: string): number {
  const nq = normalizeName(query);
  const nc = normalizeName(candidate);
  if (!nq || !nc) return 0;

  const qTokens = nq.split(" ");
  const cTokens = nc.split(" ");

  const full = ratio(nq, nc);
  const sorted = ratio(
    [...qTokens].sort().join(" "),
    [...cTokens].sort().join(" ")
  );
  const subset = tokenSubsetScore(qTokens, cTokens);

  return Math.max(full, sorted, subset);
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/**
 * Best candidate for `query` by name, or null if nothing clears `threshold`.
 * `getName` pulls the comparable name off each candidate.
 */
export function bestNameMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
  threshold = 0.82
): FuzzyMatch<T> | null {
  let best: FuzzyMatch<T> | null = null;
  for (const item of candidates) {
    const score = nameSimilarity(query, getName(item));
    if (score >= threshold && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best;
}
