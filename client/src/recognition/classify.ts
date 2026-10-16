import type { CharacterPrediction } from "../types";

/**
 * Turn raw logits into the same shape `predict.py` returns: softmax, top-1
 * label and confidence, and the three most likely labels with confidences
 * rounded to four decimals.
 */
export function classify(logits: ArrayLike<number>, labels: readonly string[]): CharacterPrediction {
  const n = logits.length;
  let max = -Infinity;
  for (let i = 0; i < n; i++) if (logits[i] > max) max = logits[i];
  const probs = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    probs[i] = Math.exp(logits[i] - max);
    sum += probs[i];
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const top = order.slice(0, 3);
  const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const top3 = top.map((i) => (i < labels.length ? labels[i] : "?"));
  const top3Conf = top.map((i) => round4(probs[i] / sum));
  return {
    prediction: top3[0],
    confidence: top3Conf[0],
    top3,
    top3_confidences: top3Conf,
  };
}
