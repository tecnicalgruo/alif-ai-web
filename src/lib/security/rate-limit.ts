type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as typeof globalThis & {
  rateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.rateLimitBuckets ??= new Map<string, Bucket>();

export function consumeRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  store = buckets,
) {
  const forwardedIp = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    ?? "unknown";
  const key = `${scope}:${forwardedIp}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    if (store.size >= 10000) {
      for (const [bucketKey, bucket] of store) {
        if (bucket.resetAt <= now) store.delete(bucketKey);
      }
      if (store.size >= 10000) {
        const oldestKey = store.keys().next().value;
        if (oldestKey) store.delete(oldestKey);
      }
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
