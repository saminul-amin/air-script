/**
 * Daily keep-warm ping for the recognition service.
 *
 * Free Hugging Face Spaces sleep after 48 hours without traffic, and a cold start can
 * take a couple of minutes — long enough for the first visitor's requests to fail with
 * 503. A Vercel cron (see vercel.json) calls this once a day so the Space never idles
 * long enough to fall asleep.
 */
export default async function handler(req, res) {
  const base = (process.env.VITE_AI_SERVICE_URL || process.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    res.status(500).json({ ok: false, error: "No absolute backend URL configured" });
    return;
  }

  const started = Date.now();
  try {
    const upstream = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(55_000) });
    res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, status: upstream.status, ms: Date.now() - started });
  } catch (error) {
    res.status(504).json({ ok: false, error: String(error), ms: Date.now() - started });
  }
}
