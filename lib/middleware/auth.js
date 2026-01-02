
import { verifyAccessToken, extractTokenFromHeader } from '../jwt.js';
import { unauthorizedResponse, forbiddenResponse } from '../response.js';
import prisma from '../prisma.js';

/**
 * Authentication Middleware
 * 
 * @param {Request} request - Next.js request
 * @param {Function} handler - Route handler
 * @param {Object} options - { roles: ['Admin', 'User'] }
 * @returns {Response}
 */
export async function withAuth(request, handler, options = {}) {
  try {
    // 1. Extract token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse('No token provided. Please login.');
    }

    // 2. Verifikasi token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return unauthorizedResponse(error.message);
    }

    // 3. ngambil user dari database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return unauthorizedResponse('User not found. Please login again.');
    }

    // 4. ngecek role 
    if (options.roles && options.roles.length > 0) {
      if (!options.roles.includes(user.role)) {
        return forbiddenResponse(
          `Access denied. Required role: ${options.roles.join(' or ')}`
        );
      }
    }

    request.user = user;

    return handler(request);

  } catch (error) {
    console.error('Authentication error:', error);
    return unauthorizedResponse('Authentication failed');
  }
}


export async function requireAdmin(request, handler) {
  return withAuth(request, handler, { roles: ['Admin'] });
}


export async function requireUser(request, handler) {
  return withAuth(request, handler, { roles: ['User', 'Admin'] });
}


export function isOwnerOrAdmin(user, resourceUserId) {
  return user.role === 'Admin' || user.id === resourceUserId;
}


export async function getUserFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) return null;

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user;
  } catch {
    return null;
  }
}

export async function withOptionalAuth(request, handler) {
  try {
    const user = await getUserFromRequest(request);
    if (user) {
      request.user = user;
    }
  } catch {
  }

  return handler(request);
}


export async function checkOwnership(request, handler, getResourceUserId) {
  try {
    if (request.user.role === 'Admin') {
      return handler(request);
    }

    const resourceUserId = await getResourceUserId();

    if (!resourceUserId) {
      return unauthorizedResponse('Resource not found');
    }

    if (request.user.id !== resourceUserId) {
      return forbiddenResponse('You do not have permission to access this resource');
    }

    return handler(request);
  } catch (error) {
    console.error('Ownership check error:', error);
    return forbiddenResponse('Access denied');
  }
}


export function createRoleMiddleware(allowedRoles) {
  return async function(request, handler) {
    return withAuth(request, handler, { roles: allowedRoles });
  };
}