/**
 * Rate Limiting Middleware
 * 
 * Middleware untuk rate limiting berdasarkan IP
 */

import { tooManyRequestsResponse } from '../response.js';

// Configuration dari environment
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);

// In-memory store
const requestCounts = new Map();

/**
 * Get Client IP
 */
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cloudflareIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (cloudflareIP) return cloudflareIP;
  if (realIP) return realIP;

  return 'unknown';
}

/**
 * Cleanup Expired Entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}

/**
 * Get Rate Limit Info
 */
function getRateLimitInfo(ip) {
  const now = Date.now();
  let data = requestCounts.get(ip);

  if (!data || now > data.resetTime) {
    data = {
      count: 0,
      resetTime: now + WINDOW_MS
    };
    requestCounts.set(ip, data);
  }

  return data;
}

/**
 * Check Rate Limit
 */
function checkRateLimit(ip) {
  const data = getRateLimitInfo(ip);
  const allowed = data.count < MAX_REQUESTS;

  if (allowed) {
    data.count++;
  }

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - data.count),
    resetTime: data.resetTime,
    limit: MAX_REQUESTS
  };
}

/**
 * Get Seconds Until Reset
 */
function getSecondsUntilReset(resetTime) {
  return Math.ceil((resetTime - Date.now()) / 1000);
}

/**
 * Rate Limiting Middleware
 * 
 * @param {Request} request - Next.js request
 * @param {Function} handler - Route handler
 * @returns {Response}
 */
export async function withRateLimit(request, handler) {
  const ip = getClientIP(request);

  // Skip untuk localhost di development
  if (process.env.NODE_ENV === 'development' && (ip === '::1' || ip === '127.0.0.1')) {
    console.log('[Rate Limit] Skipped for localhost in development');
    return handler(request);
  }

  const { allowed, remaining, resetTime, limit } = checkRateLimit(ip);

  console.log(`[Rate Limit] IP: ${ip}, Requests: ${limit - remaining}/${limit}, Remaining: ${remaining}`);

  if (!allowed) {
    const retryAfter = getSecondsUntilReset(resetTime);
    const resetDate = new Date(resetTime);

    console.warn(`[Rate Limit] EXCEEDED for IP: ${ip}, Retry after: ${retryAfter}s`);

    return tooManyRequestsResponse(
      'Too many requests. Please try again later.',
      {
        limit: MAX_REQUESTS,
        remaining: 0,
        resetTime: resetDate.toISOString(),
        retryAfter: retryAfter
      }
    );
  }

  const response = await handler(request);

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetTime.toString());

  return response;
}

/**
 * Create Custom Rate Limit
 */
export function createRateLimit(maxRequests, windowMs) {
  const customRequestCounts = new Map();

  return async function(request, handler) {
    const ip = getClientIP(request);

    if (process.env.NODE_ENV === 'development' && (ip === '::1' || ip === '127.0.0.1')) {
      return handler(request);
    }

    const now = Date.now();
    let data = customRequestCounts.get(ip);

    if (!data || now > data.resetTime) {
      data = {
        count: 0,
        resetTime: now + windowMs
      };
      customRequestCounts.set(ip, data);
    }

    const allowed = data.count < maxRequests;

    if (!allowed) {
      const retryAfter = getSecondsUntilReset(data.resetTime);
      return tooManyRequestsResponse(
        'Too many requests. Please try again later.',
        {
          limit: maxRequests,
          remaining: 0,
          resetTime: new Date(data.resetTime).toISOString(),
          retryAfter: retryAfter
        }
      );
    }

    data.count++;
    const response = await handler(request);

    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (maxRequests - data.count).toString());
    response.headers.set('X-RateLimit-Reset', data.resetTime.toString());

    return response;
  };
}

/**
 * Get Rate Limit Stats
 */
export function getRateLimitStats() {
  cleanupExpiredEntries();

  return {
    totalIPs: requestCounts.size,
    config: {
      maxRequests: MAX_REQUESTS,
      windowMs: WINDOW_MS,
      windowMinutes: WINDOW_MS / 60000
    },
    topIPs: Array.from(requestCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([ip, data]) => ({
        ip,
        count: data.count,
        resetIn: Math.ceil((data.resetTime - Date.now()) / 1000)
      }))
  };
}

// Cleanup interval
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);