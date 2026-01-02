
import { z } from 'zod';
import prisma from '@/lib/prisma.js';
import { verifyRefreshToken, generateTokens } from '@/lib/jwt.js';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { withRateLimit } from '@/lib/middleware/rateLimit.js';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

async function refreshHandler(request) {
  try {
    const body = await request.json();

    const validation = refreshSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return badRequestResponse('Validation failed', errors);
    }

    const { refreshToken } = validation.data;

    
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return unauthorizedResponse(error.message);
    }

    // fungsi Get user
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

    // buat token baru
    const newTokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return successResponse(
      {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: user
      },
      'Token refreshed successfully'
    );

  } catch (error) {
    console.error('Refresh token error:', error);
    return internalServerErrorResponse('Failed to refresh token', error);
  }
}


export async function POST(request) {
  return withLogging(request, (req) =>
    withRateLimit(req, refreshHandler)
  );
}