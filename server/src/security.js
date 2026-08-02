// Rate limiter in-memory tanpa dependency eksternal (fixed-window per IP).
// Untuk multi-instance, ganti store dengan Redis.
export function rateLimit({ windowMs = 60_000, max = 30, message } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key =
      req.ip ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown'

    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k)
    }

    let entry = hits.get(key)
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)))
      return res.status(429).json({
        success: false,
        message: message || 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
      })
    }
    next()
  }
}
