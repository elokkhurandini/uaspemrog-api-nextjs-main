
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma.js';
import { generateTokens } from '@/lib/jwt.js';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalServerErrorResponse
} from '@/lib/response.js';
import { withLogging } from '@/lib/middleware/logger.js';
import { createRateLimit } from '@/lib/middleware/rateLimit.js';

/**
 * dingge validasi Login
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

/**
 * Verifikasi Password
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}


async function loginHandler(request) {
  try {
    const body = await request.json();

    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return badRequestResponse('Validation failed', errors);
    }

    const { email, password } = validation.data;

    // cari user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return unauthorizedResponse('Invalid email or password');
    }

    // validasi Login password
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return unauthorizedResponse('Invalid email or password');
    }

    // buat token
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    
    const { password: _, ...userWithoutPassword } = user;

    return successResponse(
      {
        user: userWithoutPassword,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      'Login successful'
    );

  } catch (error) {
    console.error('Login error:', error);
    return internalServerErrorResponse('Login failed', error);
  }
}


const loginRateLimit = createRateLimit(5, 60 * 1000);


export async function POST(request) {
  return withLogging(request, (req) =>
    loginRateLimit(req, loginHandler)
  );
}