/**
 * Tasks CRUD Endpoints
 * 
 * GET /api/tasks - Get all tasks
 * POST /api/tasks - Create new task
 */

import { z } from 'zod';
import prisma from '@/lib/prisma.js';
import { withAuth } from '@/lib/middleware/auth.js';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { withRateLimit } from '@/lib/middleware/rateLimit.js';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('PENDING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable()
});


async function getTasksHandler(request) {
  try {
    const user = request.user;
    const { searchParams } = new URL(request.url);

    const where = {};

    if (user.role !== 'Admin') {
      where.userId = user.id;
    }

    const status = searchParams.get('status');
    if (status) {
      where.status = status;
    }

    const priority = searchParams.get('priority');
    if (priority) {
      where.priority = priority;
    }

    const search = searchParams.get('search');
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return successResponse(tasks, 'Tasks retrieved successfully');

  } catch (error) {
    console.error('Get tasks error:', error);
    return internalServerErrorResponse('Failed to retrieve tasks', error);
  }
}


async function createTaskHandler(request) {
  try {
    const user = request.user;
    const body = await request.json();

    const validation = createTaskSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return badRequestResponse('Validation failed', errors);
    }

    const { title, description, status, priority, dueDate } = validation.data;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    return createdResponse(task, 'Task created successfully');

  } catch (error) {
    console.error('Create task error:', error);
    return internalServerErrorResponse('Failed to create task', error);
  }
}


export async function GET(request) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      withAuth(r, getTasksHandler)
    )
  );
}


export async function POST(request) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      withAuth(r, createTaskHandler)
    )
  );
}