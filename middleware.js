/**
 * Next.js Edge Middleware (jose)
 * Verifikasi JWT di Edge runtime menggunakan `jose`
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Route Configuration (sesuaikan jika perlu)
 */
const ROUTE_CONFIG = {
  public: [
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/refresh'
  ],
  protected: [
    '/api/tasks',
    '/api/tasks/.*'
  ],
  adminOnly: [
    '/api/users',
    '/api/users/.*'
  ]
};

function matchesPattern(path, patterns) {
  return patterns.some(pattern => {
    if (pattern.includes('.*')) {
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    }
    return path === pattern;
  });
}

function getRouteType(path) {
  if (matchesPattern(path, ROUTE_CONFIG.public)) return 'public';
  if (matchesPattern(path, ROUTE_CONFIG.adminOnly)) return 'adminOnly';
  if (matchesPattern(path, ROUTE_CONFIG.protected)) return 'protected';
  return 'public';
}

function errorResponse(message, status) {
  return NextResponse.json(
    { success: false, error: message, code: status },
    { status }
  );
}

/**
 * Verify token menggunakan `jose`
 * Note: process.env.JWT_SECRET harus ada (string)
 */
async function verifyTokenEdge(token) {
  try {
    // `TextEncoder` -> menghasilkan Uint8Array yang diterima jose di Edge
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');

    // jwtVerify akan me-throw jika token invalid/expired
    const { payload } = await jwtVerify(token, secret);

    // payload berisi klaim: id, email, role, dsb.
    return payload;
  } catch (err) {
    // Lempar error supaya caller tahu kenapa gagal (nama/error.message membantu debug)
    throw err;
  }
}

/**
 * Main middleware
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  console.log(`[Middleware] ${request.method} ${pathname}`);

  const routeType = getRouteType(pathname);

  if (routeType === 'public') {
    console.log('[Middleware] Public route - allowed');
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Middleware] No token provided');
    return errorResponse('No token provided. Please login.', 401);
  }

  const token = authHeader.substring(7);

  let payload;
  try {
    payload = await verifyTokenEdge(token);
  } catch (err) {
    console.log('[Middleware] Token verification failed:', err.name, err.message);
    return errorResponse('Invalid or expired token. Please login again.', 401);
  }

  // Ambil claim yang diperlukan dari payload (sesuaikan nama klaim di tokenmu)
  const decoded = {
    id: payload.id || payload.sub || null,
    email: payload.email || null,
    role: payload.role || payload.roles || 'User',
  };

  console.log(`[Middleware] Token valid for user: ${decoded.id} (${decoded.role})`);

  // Autorisasi route admin
  if (routeType === 'adminOnly' && decoded.role !== 'Admin') {
    console.log('[Middleware] Access denied - Admin role required');
    return errorResponse('Access denied. Admin role required.', 403);
  }

  // DELETE /api/tasks/:id requires Admin
  if (request.method === 'DELETE' && pathname.startsWith('/api/tasks/')) {
    if (decoded.role !== 'Admin') {
      console.log('[Middleware] Access denied - DELETE tasks requires Admin role');
      return errorResponse('Access denied. Only Admin can delete tasks.', 403);
    }
  }

  // Tambahkan header custom agar API route menerima info user
  const requestHeaders = new Headers(request.headers);
  if (decoded.id) requestHeaders.set('x-user-id', String(decoded.id));
  if (decoded.email) requestHeaders.set('x-user-email', String(decoded.email));
  if (decoded.role) requestHeaders.set('x-user-role', String(decoded.role));

  console.log('[Middleware] Request authorized - continuing to handler');

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ['/api/:path*']
};
