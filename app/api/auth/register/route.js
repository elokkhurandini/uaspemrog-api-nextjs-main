
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '@/lib/prisma.js';
import {
  createdResponse,
  badRequestResponse,
  conflictResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { createRateLimit } from '@/lib/middleware/rateLimit.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['User', 'Admin']).optional().default('User')
});

async function hashPassword(password) {
  const SALT_ROUNDS = 10;
  return bcrypt.hash(password, SALT_ROUNDS);
}


async function registerHandler(request) {
  try {
    const body = await request.json();

    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return badRequestResponse('Validation failed', errors);
    }

    const { name, email, password, role } = validation.data;

    // ngecek user sng ws enk
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return conflictResponse('Email already registered');
    }

    
    const hashedPassword = await hashPassword(password);

    // buat user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return createdResponse(user, 'User registered successfully');

  } catch (error) {
    console.error('Register error:', error);

 
    if (error.code === 'P2002') {
      return conflictResponse('Email already registered');
    }

    return internalServerErrorResponse('Failed to register user', error);
  }
}


const registerRateLimit = createRateLimit(10, 15 * 60 * 1000);

export async function POST(request) {
  return withLogging(request, (req) =>
    registerRateLimit(req, registerHandler)
  );
}