
import { z } from 'zod';
import prisma from '@/lib/prisma.js';
import { withAuth, requireAdmin, isOwnerOrAdmin } from '@/lib/middleware/auth.js';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { withRateLimit } from '@/lib/middleware/rateLimit.js';

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable()
});


async function getTaskHandler(request, context) {
  try {
    const user = request.user;
    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id },
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

    if (!task) {
      return notFoundResponse('Task not found');
    }

 
    if (!isOwnerOrAdmin(user, task.userId)) {
      return forbiddenResponse('You do not have permission to access this task');
    }

    return successResponse(task, 'Task retrieved successfully');

  } catch (error) {
    console.error('Get task error:', error);
    return internalServerErrorResponse('Failed to retrieve task', error);
  }
}


async function updateTaskHandler(request, context) {
  try {
    const user = request.user;
    const { id } = await context.params;
    const body = await request.json();

    const validation = updateTaskSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return badRequestResponse('Validation failed', errors);
    }

    
    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return notFoundResponse('Task not found');
    }

  
    if (!isOwnerOrAdmin(user, existingTask.userId)) {
      return forbiddenResponse('You do not have permission to update this task');
    }

    const updateData = { ...validation.data };

    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }


    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
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

    return successResponse(updatedTask, 'Task updated successfully');

  } catch (error) {
    console.error('Update task error:', error);
    return internalServerErrorResponse('Failed to update task', error);
  }
}


async function deleteTaskHandler(request, context) {
  try {
    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return notFoundResponse('Task not found');
    }

    await prisma.task.delete({
      where: { id }
    });

    return successResponse(null, 'Task deleted successfully');

  } catch (error) {
    console.error('Delete task error:', error);
    return internalServerErrorResponse('Failed to delete task', error);
  }
}


export async function GET(request, context) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      withAuth(r, (authedReq) => getTaskHandler(authedReq, context))
    )
  );
}


export async function PUT(request, context) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      withAuth(r, (authedReq) => updateTaskHandler(authedReq, context))
    )
  );
}

export async function DELETE(request, context) {
  return withLogging(request, (req) =>
    withRateLimit(req, (r) =>
      requireAdmin(r, (authedReq) => deleteTaskHandler(authedReq, context))
    )
  );
}