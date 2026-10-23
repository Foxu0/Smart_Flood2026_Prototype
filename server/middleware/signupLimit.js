// Public sign-up forms (SMS / email alerts) have no login, so limit how often one
// computer can submit: at most 5 sign-ups every 10 minutes per IP address.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]

export function signupLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || 'unknown';
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ success: false, error: 'Too many sign-ups. Please try again in a few minutes.' });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}
