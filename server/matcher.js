// Lightweight fuzzy matching so players don't have to type song titles
// perfectly. No external deps: just normalization + Levenshtein distance.

export function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ") // drop "(Remastered 2011)" etc.
    .replace(/feat\.?.*$/i, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// Returns true if `guess` is a reasonably close match to the track title.
export function isCorrectGuess(guess, trackName) {
  const g = normalize(guess);
  const t = normalize(trackName);
  if (!g) return false;
  if (g === t) return true;
  if (t.includes(g) && g.length >= 3) return true;

  const distance = levenshtein(g, t);
  const threshold = Math.max(1, Math.floor(t.length * 0.25));
  return distance <= threshold;
}
