import { createHash } from "node:crypto";
import { getPrisma } from "../database/prisma";

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as typeof globalThis & {
  rateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.rateLimitBuckets ??= new Map<string, Bucket>();
let lastDatabaseSweep = 0;
let warnedMissingRateLimitTable = false;

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

export async function consumeDistributedRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const prisma = getPrisma();
  if (!prisma) {
    return { ...consumeRateLimit(request, scope, limit, windowMs, now), distributed: false, unavailable: false, degraded: false };
  }

  const forwardedIp = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    ?? "unknown";
  const subjectHash = createHash("sha256").update(forwardedIp).digest("hex");
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = windowStart.getTime() + windowMs;

  try {
    const bucket = await prisma.apiRateLimit.upsert({
      where: {
        scope_subjectHash_windowStart: { scope, subjectHash, windowStart },
      },
      create: { scope, subjectHash, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (now - lastDatabaseSweep >= 60 * 60 * 1000) {
      await prisma.apiRateLimit.deleteMany({
        where: { windowStart: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
      });
      lastDatabaseSweep = now;
    }

    warnedMissingRateLimitTable = false;
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: bucket.count <= limit ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
      distributed: true,
      unavailable: false,
      degraded: false,
    };
  } catch (error) {
    if (isMissingRateLimitTable(error)) {
      if (!warnedMissingRateLimitTable) {
        console.warn("ApiRateLimit table is missing; using per-instance limits until Prisma migrations are applied.");
        warnedMissingRateLimitTable = true;
      }
      return {
        ...consumeRateLimit(request, scope, limit, windowMs, now),
        distributed: false,
        unavailable: false,
        degraded: true,
      };
    }
    console.error("Distributed rate limiting failed:", error);
    return { allowed: false, retryAfterSeconds: 0, distributed: true, unavailable: true, degraded: false };
  }
}

export function isMissingRateLimitTable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2021");
}

export function rateLimitHeaders(distributed: boolean, degraded: boolean) {
  return {
    "X-Rate-Limit-Store": distributed ? "postgres" : "instance",
    ...(degraded ? { "X-Rate-Limit-Notice": "Shared rate limits are waiting for database migrations." } : {}),
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function rateLimitUnavailableResponse() {
  return Response.json(
    { error: "Request protection is temporarily unavailable. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "30" } },
  );
}
