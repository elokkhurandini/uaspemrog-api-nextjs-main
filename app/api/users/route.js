

import prisma from '@/lib/prisma.js';
import { requireAdmin } from '@/lib/middleware/auth.js';
import {
  successResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { withRateLimit } from '@/lib/middleware/rateLimit.js';


async function getUsersHandler(request) {
  try {
    const { searchParams } = new URL(request.url);

    const where = {};

    const role = searchParams.get('role');
    if (role) {
      where.role = role;
    }

    const search = searchParams.get('search');
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tasks: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const usersWithStats = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      taskCount: user._count.tasks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return successResponse(usersWithStats, 'Users retrieved successfully');

  } catch (error) {
    console.error('Get users error:', error);
    return internalServerErrorResponse('Failed to retrieve users', error);
  }
}


export async function GET(request) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      requireAdmin(r, getUsersHandler)
    )
  );
}